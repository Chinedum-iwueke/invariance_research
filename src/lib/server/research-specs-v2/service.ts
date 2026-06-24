import { randomUUID } from "node:crypto";
import { hashLifecycleEvent, RESEARCH_LIFECYCLE_VERSION, type ResearchLifecycleEvent } from "@/lib/contracts/research-lifecycle";
import { researchCopilotRepository } from "@/lib/server/research-copilot/repository";
import { researchProgramRepository } from "@/lib/server/research-programs/repository";
import { buildDraftCardFromProposal, buildSpecBundle, canonicalHash, COMPILER_VERSION, confirmCard, validateHypothesisCardV1 } from "@/lib/server/research-specs-v2/generation";
import type { HypothesisCardRecord, HypothesisCardV1, ResearchSpecBundleRecord } from "@/lib/server/research-specs-v2/models";
import { researchSpecV2Repository } from "@/lib/server/research-specs-v2/repository";

async function assertProgram(programId: string, accountId: string) {
  const program = await researchProgramRepository.findSummaryById(programId);
  if (!program || program.account_id !== accountId) throw new Error("program_not_found");
  return program;
}

async function lifecycle(input: { eventType: ResearchLifecycleEvent["event_type"]; programId: string; accountId: string; userId: string; strategyHash: string; payload: Record<string, unknown>; now: string }) {
  const base: Omit<ResearchLifecycleEvent, "event_hash"> = { schema_version: RESEARCH_LIFECYCLE_VERSION, event_id: randomUUID(), event_type: input.eventType, occurred_at: input.now, identity: { program_id: input.programId, account_id: input.accountId, stage: "backtest", strategy_spec_hash: input.strategyHash, code_hash: "not_compiled", data_snapshot_id: "not_selected" }, payload: input.payload, actor: { type: "user", id: input.userId } };
  await researchSpecV2Repository.appendLifecycle({ ...base, event_hash: hashLifecycleEvent(base) });
}

export async function getResearchSpecBridgeDetail(programId: string, accountId: string) {
  await assertProgram(programId, accountId);
  return researchSpecV2Repository.list(programId, accountId);
}

export async function createCardFromProposal(input: { programId: string; proposalId: string; accountId: string; userId: string }) {
  await assertProgram(input.programId, input.accountId);
  const proposal = (await researchCopilotRepository.listProposals(input.programId)).find((item) => item.proposal_id === input.proposalId && item.account_id === input.accountId);
  if (!proposal) throw new Error("proposal_not_found");
  if (proposal.status !== "confirmed") throw new Error("proposal_must_be_confirmed");
  const existing = await researchSpecV2Repository.list(input.programId, input.accountId);
  if (existing.cards.some((item) => item.source_proposal_id === proposal.proposal_id)) throw new Error("proposal_card_already_exists");
  const now = new Date().toISOString();
  const card = buildDraftCardFromProposal({ proposal, programId: input.programId, userId: input.userId, now });
  const record: HypothesisCardRecord = { card_record_id: randomUUID(), card_id: card.card_id, program_id: input.programId, account_id: input.accountId, source_proposal_id: proposal.proposal_id, version: 1, status: "draft", card, card_hash: canonicalHash(card), validation_errors: validateHypothesisCardV1(card), created_by_user_id: input.userId, created_at: now };
  await researchSpecV2Repository.saveCard(record);
  await lifecycle({ eventType: "hypothesis_card", programId: input.programId, accountId: input.accountId, userId: input.userId, strategyHash: record.card_hash, payload: { card_record_id: record.card_record_id, card_id: record.card_id, version: 1, status: "draft", source_proposal_id: proposal.proposal_id }, now });
  return record;
}

export async function reviseCard(input: { programId: string; cardRecordId: string; accountId: string; userId: string; card: HypothesisCardV1 }) {
  await assertProgram(input.programId, input.accountId);
  const previous = await researchSpecV2Repository.findCard(input.cardRecordId, input.accountId);
  if (!previous || previous.program_id !== input.programId) throw new Error("hypothesis_card_not_found");
  if (previous.status === "confirmed") throw new Error("confirmed_card_is_immutable");
  const now = new Date().toISOString();
  const card = { ...input.card, schema_version: "hypothesis_card_v1" as const, card_id: previous.card_id, program_id: input.programId, version: previous.version + 1, status: "draft" as const, confirmed_at: undefined, confirmed_by: undefined };
  const record: HypothesisCardRecord = { ...previous, card_record_id: randomUUID(), version: card.version, status: "draft", card, card_hash: canonicalHash(card), validation_errors: validateHypothesisCardV1(card), created_by_user_id: input.userId, created_at: now, confirmed_at: undefined, confirmed_by_user_id: undefined };
  await researchSpecV2Repository.saveCard(record);
  return record;
}

export async function confirmHypothesisCard(input: { programId: string; cardRecordId: string; accountId: string; userId: string }) {
  await assertProgram(input.programId, input.accountId);
  const previous = await researchSpecV2Repository.findCard(input.cardRecordId, input.accountId);
  if (!previous || previous.program_id !== input.programId) throw new Error("hypothesis_card_not_found");
  const existingConfirmation = (await researchSpecV2Repository.list(input.programId, input.accountId)).cards.find((item) => item.card_id === previous.card_id && item.status === "confirmed" && item.version === previous.version + 1);
  if (existingConfirmation) return existingConfirmation;
  const now = new Date().toISOString();
  const card = confirmCard({ ...previous.card, version: previous.version + 1 }, input.userId, now);
  const errors = validateHypothesisCardV1(card, true);
  if (errors.length) throw new Error(errors.join(";"));
  const record: HypothesisCardRecord = { ...previous, card_record_id: randomUUID(), version: card.version, status: "confirmed", card, card_hash: canonicalHash(card), validation_errors: [], created_by_user_id: input.userId, created_at: now, confirmed_at: now, confirmed_by_user_id: input.userId };
  await researchSpecV2Repository.saveCard(record);
  await lifecycle({ eventType: "confirmation", programId: input.programId, accountId: input.accountId, userId: input.userId, strategyHash: record.card_hash, payload: { object_type: "hypothesis_card", object_id: record.card_record_id, card_record_id: record.card_record_id, card_id: record.card_id, version: record.version }, now });
  return record;
}

export async function generateResearchSpecBundle(input: { programId: string; cardRecordId: string; accountId: string; userId: string; availableDatasets?: string[] }) {
  await assertProgram(input.programId, input.accountId);
  const cardRecord = await researchSpecV2Repository.findCard(input.cardRecordId, input.accountId);
  if (!cardRecord || cardRecord.program_id !== input.programId) throw new Error("hypothesis_card_not_found");
  if (cardRecord.status !== "confirmed") throw new Error("confirmed_card_required");
  const detail = await researchSpecV2Repository.list(input.programId, input.accountId);
  const existingBundle = detail.bundles.find((item) => item.card_record_id === cardRecord.card_record_id);
  if (existingBundle) return existingBundle;
  const bundle = buildSpecBundle(cardRecord.card, input.availableDatasets);
  const now = new Date().toISOString();
  const record: ResearchSpecBundleRecord = { spec_bundle_id: randomUUID(), program_id: input.programId, account_id: input.accountId, card_record_id: cardRecord.card_record_id, version: detail.bundles.filter((item) => item.card_record_id === cardRecord.card_record_id).length + 1, status: "generated", bundle, bundle_hash: canonicalHash(bundle), compile_status: bundle.compile_readiness.status, compiler_version: COMPILER_VERSION, validation_errors: [], generated_by_user_id: input.userId, generated_at: now };
  await researchSpecV2Repository.saveBundle(record);
  if ("implementation_task" in bundle) {
    const task = bundle.implementation_task as Record<string, unknown>;
    await researchSpecV2Repository.saveTask({ task_id: String(task.task_id), program_id: input.programId, account_id: input.accountId, spec_bundle_id: record.spec_bundle_id, status: "draft", task, evidence: { required: task.required_evidence, submitted: [] }, created_at: now });
  }
  return record;
}

export async function approveResearchSpecBundle(input: { programId: string; bundleId: string; accountId: string; userId: string }) {
  await assertProgram(input.programId, input.accountId);
  const detail = await researchSpecV2Repository.list(input.programId, input.accountId);
  const bundle = detail.bundles.find((item) => item.spec_bundle_id === input.bundleId);
  if (!bundle) throw new Error("spec_bundle_not_found");
  if (bundle.status !== "generated") throw new Error("spec_bundle_already_decided");
  const now = new Date().toISOString();
  await researchSpecV2Repository.approveBundle(bundle.spec_bundle_id, input.accountId, input.userId, now);
  await lifecycle({ eventType: "confirmation", programId: input.programId, accountId: input.accountId, userId: input.userId, strategyHash: String((bundle.bundle.strategy_spec as Record<string, unknown>)?.source_card_hash ?? bundle.bundle_hash), payload: { object_type: "research_spec_bundle", object_id: bundle.spec_bundle_id, spec_bundle_id: bundle.spec_bundle_id, compile_status: bundle.compile_status, execution_authorized: false }, now });
}

export async function submitImplementationEvidence(input: { programId: string; taskId: string; accountId: string; userId: string; evidence: Record<string, unknown> }) {
  await assertProgram(input.programId, input.accountId);
  const task = await researchSpecV2Repository.findTask(input.taskId, input.accountId);
  if (!task || task.program_id !== input.programId) throw new Error("implementation_task_not_found");
  if (!["draft", "in_review"].includes(task.status)) throw new Error("implementation_task_not_editable");
  const required = Array.isArray(task.task.required_evidence) ? task.task.required_evidence.map(String) : [];
  const submitted = input.evidence.submitted && typeof input.evidence.submitted === "object" ? input.evidence.submitted as Record<string, unknown> : {};
  const missing = required.filter((key) => !submitted[key]);
  const evidence = { ...input.evidence, required, missing, submitted_by_user_id: input.userId, submitted_at: new Date().toISOString() };
  await researchSpecV2Repository.updateTask({ taskId: task.task_id, accountId: input.accountId, status: "in_review", evidence });
  return { ...task, status: "in_review" as const, evidence };
}

export async function approveImplementationTask(input: { programId: string; taskId: string; accountId: string; userId: string }) {
  await assertProgram(input.programId, input.accountId);
  const task = await researchSpecV2Repository.findTask(input.taskId, input.accountId);
  if (!task || task.program_id !== input.programId) throw new Error("implementation_task_not_found");
  if (task.status !== "in_review") throw new Error("implementation_task_not_in_review");
  const required = Array.isArray(task.task.required_evidence) ? task.task.required_evidence.map(String) : [];
  const submitted = task.evidence.submitted && typeof task.evidence.submitted === "object" ? task.evidence.submitted as Record<string, unknown> : {};
  const missing = required.filter((key) => {
    const evidence = submitted[key];
    return !evidence || typeof evidence !== "object" || (evidence as Record<string, unknown>).status !== "pass" || !(evidence as Record<string, unknown>).artifact_hash;
  });
  if (missing.length) throw new Error(`implementation_evidence_missing_or_failed:${missing.join(",")}`);
  if (!task.evidence.diff_hash) throw new Error("implementation_diff_hash_required");
  const now = new Date().toISOString();
  await researchSpecV2Repository.updateTask({ taskId: task.task_id, accountId: input.accountId, status: "approved", evidence: { ...task.evidence, approved_without_execution: true }, approvedAt: now, approvedByUserId: input.userId });
  return { ...task, status: "approved" as const };
}
