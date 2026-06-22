import { randomUUID } from "node:crypto";
import type { AnalysisListItem } from "@/lib/contracts";
import { listAnalyses, getOwnedAnalysis } from "@/lib/server/services/analysis-service";
import { researchProgramRepository } from "@/lib/server/research-programs/repository";
import {
  buildClarificationDraft,
  buildResearchBrief,
  normalizeIntake,
} from "@/lib/server/research-programs/clarification";
import type {
  CreateProgramInput,
  HypothesisApprovalRecord,
  HypothesisSpecV1,
  ProgramDetail,
  ResearchBriefIntakeFields,
  ResearchProgram,
  StrategySpecV1,
} from "@/lib/server/research-programs/models";
import {
  buildHypothesisSpecFromBrief,
  buildStrategySpecFromHypothesis,
  validateHypothesisSpec,
  validateStrategySpec,
} from "@/lib/server/research-programs/spec-generation";
import {
  buildExperimentPlanFromStrategySpec,
  validateExperimentPlan,
} from "@/lib/server/research-programs/experiment-planning";
import { accountService } from "@/lib/server/accounts/service";
import {
  assertAssistantCallAllowed,
  assertExperimentQueueAllowed,
  assertHypothesisCreationAllowed,
  assertProgramCreationAllowed,
} from "@/lib/server/entitlements/research-policy";
import { logger } from "@/lib/server/ops/logger";
import { assertAssistantAccepting, assertQueueAccepting } from "@/lib/server/ops/operations-policy";
import { emptyResearchMemorySnapshot, listResearchMemory } from "@/lib/server/research-memory/service";

function isMissingPostgresRelation(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "42P01";
}

function cleanText(value: FormDataEntryValue | null | undefined): string | undefined {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return text.length > 0 ? text : undefined;
}

export function parseCreateProgramForm(formData: FormData, session: { account_id: string; user_id: string }): CreateProgramInput {
  const title = cleanText(formData.get("title"));
  const thesis = cleanText(formData.get("thesis"));
  if (!title) throw new Error("program_title_required");
  if (!thesis) throw new Error("program_thesis_required");
  return {
    account_id: session.account_id,
    owner_user_id: session.user_id,
    title,
    thesis,
    market: "crypto",
    asset_universe: cleanText(formData.get("asset_universe")),
    timeframe: cleanText(formData.get("timeframe")),
  };
}

export async function createResearchProgram(input: CreateProgramInput): Promise<ResearchProgram> {
  await assertProgramCreationAllowed(input.account_id);
  const now = new Date().toISOString();
  const program: ResearchProgram = {
    program_id: randomUUID(),
    account_id: input.account_id,
    owner_user_id: input.owner_user_id,
    title: input.title,
    thesis: input.thesis,
    status: "active",
    market: input.market,
    asset_universe: input.asset_universe,
    timeframe: input.timeframe,
    next_action: "Clarify the thesis into testable hypotheses.",
    created_at: now,
    updated_at: now,
  };

  await researchProgramRepository.save(program);
  await researchProgramRepository.saveMember({
    program_id: program.program_id,
    account_id: program.account_id,
    user_id: input.owner_user_id,
    role: "owner",
    created_at: now,
  });
  await researchProgramRepository.recordEvent({
    event_id: randomUUID(),
    program_id: program.program_id,
    account_id: program.account_id,
    actor_user_id: input.owner_user_id,
    event_type: "program_created",
    title: "Research program created",
    summary: "A thesis container was opened for hypotheses, imports, runs, verdicts, memory, and reports.",
    payload: {
      market: input.market,
      asset_universe: input.asset_universe,
      timeframe: input.timeframe,
    },
    created_at: now,
  });
  await accountService.incrementUsage(input.account_id, "program");

  return program;
}

export async function listResearchPrograms(accountId: string) {
  try {
    return await researchProgramRepository.listSummaries(accountId);
  } catch (error) {
    if (isMissingPostgresRelation(error)) {
      logger.error("research_programs.schema_missing", {
        account_id: accountId,
        message: error instanceof Error ? error.message : "missing relation",
      });
      return [];
    }
    throw error;
  }
}

export async function listExperimentJobsForAccount(accountId: string) {
  try {
    return await researchProgramRepository.listExperimentJobsForAccount(accountId);
  } catch (error) {
    if (isMissingPostgresRelation(error)) {
      logger.error("experiment_jobs.schema_missing", {
        account_id: accountId,
        message: error instanceof Error ? error.message : "missing relation",
      });
      return [];
    }
    throw error;
  }
}

export async function getResearchProgramDetail(programId: string, accountId: string): Promise<ProgramDetail | undefined> {
  const program = await researchProgramRepository.findSummaryById(programId);
  if (!program || program.account_id !== accountId) return undefined;

  const allAnalyses = await listAnalyses(accountId);
  const artifacts = await researchProgramRepository.listArtifacts(programId);
  const attachedIds = new Set(artifacts.map((artifact) => artifact.analysis_id).filter((id): id is string => Boolean(id)));
  const analyses = allAnalyses.filter((analysis) => attachedIds.has(analysis.analysis_id));

  return {
    program,
    events: await researchProgramRepository.listEvents(programId),
    notes: await researchProgramRepository.listNotes(programId),
    artifacts,
    analyses,
    clarification_sessions: await researchProgramRepository.listClarificationSessions(programId),
    research_briefs: await researchProgramRepository.listResearchBriefs(programId),
    hypotheses: await researchProgramRepository.listHypotheses(programId),
    hypothesis_versions: await researchProgramRepository.listHypothesisVersions(programId),
    strategy_specs: await researchProgramRepository.listStrategySpecs(programId),
    experiment_plans: await researchProgramRepository.listExperimentPlans(programId),
    experiment_plan_items: await researchProgramRepository.listExperimentPlanItems(programId),
    experiment_jobs: await researchProgramRepository.listExperimentJobs(programId),
    experiment_job_events: await researchProgramRepository.listExperimentJobEventsForProgram(programId),
    reports: await researchProgramRepository.listProgramReports(programId),
    memory: await listResearchMemory(accountId, programId).catch((error) => {
      if (isMissingPostgresRelation(error)) {
        logger.error("research_memory.schema_missing", {
          account_id: accountId,
          program_id: programId,
          message: error instanceof Error ? error.message : "missing relation",
        });
        return emptyResearchMemorySnapshot();
      }
      throw error;
    }),
  };
}

export async function listAttachableAnalysesForProgram(programId: string, accountId: string): Promise<AnalysisListItem[]> {
  const detail = await getResearchProgramDetail(programId, accountId);
  if (!detail) return [];
  const attachedIds = new Set(detail.analyses.map((analysis) => analysis.analysis_id));
  return (await listAnalyses(accountId)).filter((analysis) => !attachedIds.has(analysis.analysis_id));
}

export async function attachAnalysisToResearchProgram(input: {
  program_id: string;
  analysis_id: string;
  account_id: string;
  user_id: string;
}): Promise<void> {
  const program = await researchProgramRepository.findSummaryById(input.program_id);
  if (!program || program.account_id !== input.account_id) throw new Error("program_not_found");

  const analysis = await getOwnedAnalysis(input.analysis_id, input.account_id);
  if (!analysis) throw new Error("analysis_not_found");

  const now = new Date().toISOString();
  await researchProgramRepository.attachAnalysis({
    program_artifact_id: randomUUID(),
    program_id: input.program_id,
    account_id: input.account_id,
    artifact_id: analysis.artifact_id,
    analysis_id: analysis.analysis_id,
    attached_by_user_id: input.user_id,
    created_at: now,
  });
  await researchProgramRepository.recordEvent({
    event_id: randomUUID(),
    program_id: input.program_id,
    account_id: input.account_id,
    actor_user_id: input.user_id,
    event_type: "analysis_attached",
    title: "Existing evidence attached",
    summary: `${analysis.strategy_name ?? "Imported analysis"} was attached as audit evidence for this program.`,
    payload: {
      analysis_id: analysis.analysis_id,
      artifact_id: analysis.artifact_id,
      status: analysis.status,
    },
    created_at: now,
  });
}

export async function createClarificationSession(input: {
  program_id: string;
  account_id: string;
  user_id: string;
  intake: unknown;
}) {
  const program = await researchProgramRepository.findSummaryById(input.program_id);
  if (!program || program.account_id !== input.account_id) throw new Error("program_not_found");
  assertAssistantAccepting();
  await assertAssistantCallAllowed(input.account_id);

  const intake = normalizeIntake(input.intake);
  const draft = await buildClarificationDraft(program, intake);
  const now = new Date().toISOString();
  const session = await researchProgramRepository.saveClarificationSession({
    session_id: randomUUID(),
    program_id: program.program_id,
    account_id: input.account_id,
    created_by_user_id: input.user_id,
    status: "draft",
    raw_intuition: intake.market_intuition,
    intake_fields: intake,
    assistant_questions: draft.questions,
    missing_assumptions: draft.missing_assumptions,
    provider: draft.provider,
    model: draft.model,
    error_summary: draft.error_summary,
    created_at: now,
    updated_at: now,
  });

  await researchProgramRepository.recordEvent({
    event_id: randomUUID(),
    program_id: program.program_id,
    account_id: input.account_id,
    actor_user_id: input.user_id,
    event_type: "note_added",
    title: "Idea intake clarified",
    summary: `${session.assistant_questions.length} clarification questions and ${session.missing_assumptions.length} missing assumptions were recorded.`,
    payload: {
      session_id: session.session_id,
      provider: session.provider,
      model: session.model,
      missing_assumption_count: session.missing_assumptions.length,
    },
    created_at: now,
  });
  await accountService.incrementUsage(input.account_id, "assistant");

  return session;
}

export async function acceptClarificationSession(input: {
  program_id: string;
  session_id: string;
  account_id: string;
  user_id: string;
  answers: Record<string, string>;
}) {
  const program = await researchProgramRepository.findSummaryById(input.program_id);
  if (!program || program.account_id !== input.account_id) throw new Error("program_not_found");
  const session = await researchProgramRepository.findClarificationSession(input.session_id);
  if (!session || session.program_id !== program.program_id || session.account_id !== input.account_id) throw new Error("clarification_session_not_found");

  const now = new Date().toISOString();
  const acceptedAnswers = Object.fromEntries(
    Object.entries(input.answers)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value.length > 0),
  );
  const answeredFields = new Set(
    session.assistant_questions
      .filter((question) => acceptedAnswers[question.question_id]?.trim())
      .map((question) => String(question.field)),
  );
  const remainingMissing = session.missing_assumptions.filter((assumption) => !answeredFields.has(assumption.field));
  const brief = buildResearchBrief({
    program,
    intake: session.intake_fields as ResearchBriefIntakeFields,
    answers: acceptedAnswers,
    missingAssumptions: remainingMissing,
    createdAt: now,
  });
  const existingBriefs = await researchProgramRepository.listResearchBriefs(program.program_id);
  const record = await researchProgramRepository.saveResearchBrief({
    brief_id: randomUUID(),
    program_id: program.program_id,
    account_id: input.account_id,
    clarification_session_id: session.session_id,
    version: existingBriefs.length + 1,
    status: "accepted",
    brief,
    created_by_user_id: input.user_id,
    created_at: now,
    accepted_at: now,
  });
  await researchProgramRepository.acceptClarificationSession({
    session_id: session.session_id,
    accepted_answers: acceptedAnswers,
    research_brief: brief,
    accepted_at: now,
  });
  await researchProgramRepository.recordEvent({
    event_id: randomUUID(),
    program_id: program.program_id,
    account_id: input.account_id,
    actor_user_id: input.user_id,
    event_type: "hypothesis_created",
    title: "Research brief accepted",
    summary: `Research brief v${record.version} was accepted and is ready for hypothesis drafting when blocking assumptions are resolved.`,
    payload: {
      brief_id: record.brief_id,
      brief_version: record.version,
      readiness: brief.readiness,
      remaining_missing_assumptions: brief.missing_assumptions.length,
    },
    created_at: now,
  });
  return record;
}

export async function createHypothesisFromBrief(input: {
  program_id: string;
  brief_id: string;
  account_id: string;
  user_id: string;
}) {
  const program = await researchProgramRepository.findSummaryById(input.program_id);
  if (!program || program.account_id !== input.account_id) throw new Error("program_not_found");
  assertAssistantAccepting();
  await assertHypothesisCreationAllowed({ account_id: input.account_id, program_id: input.program_id });
  const briefs = await researchProgramRepository.listResearchBriefs(program.program_id);
  const brief = briefs.find((item) => item.brief_id === input.brief_id);
  if (!brief) throw new Error("research_brief_not_found");

  const now = new Date().toISOString();
  const hypothesisId = randomUUID();
  const hypothesisVersionId = randomUUID();
  const spec = buildHypothesisSpecFromBrief({ program, brief, hypothesisId, generatedAt: now });
  const validationErrors = validateHypothesisSpec(spec);
  const status = validationErrors.length > 0 ? "needs_clarification" : "draft";
  const existingVersions = await researchProgramRepository.listHypothesisVersions(program.program_id);

  const version = await researchProgramRepository.saveHypothesis({
    hypothesis: {
      hypothesis_id: hypothesisId,
      program_id: program.program_id,
      account_id: input.account_id,
      title: spec.title,
      status,
      created_by_user_id: input.user_id,
      created_at: now,
      updated_at: now,
    },
    version: {
      hypothesis_version_id: hypothesisVersionId,
      hypothesis_id: hypothesisId,
      program_id: program.program_id,
      account_id: input.account_id,
      version: existingVersions.length + 1,
      status,
      source_brief_id: brief.brief_id,
      spec,
      validation_errors: validationErrors,
      created_by_user_id: input.user_id,
      created_at: now,
    },
    approval: {
      approval_id: randomUUID(),
      hypothesis_version_id: hypothesisVersionId,
      hypothesis_id: hypothesisId,
      program_id: program.program_id,
      account_id: input.account_id,
      actor_user_id: input.user_id,
      to_status: status,
      note: "Hypothesis spec drafted from accepted research brief.",
      created_at: now,
    } satisfies HypothesisApprovalRecord,
  });

  await researchProgramRepository.recordEvent({
    event_id: randomUUID(),
    program_id: program.program_id,
    account_id: input.account_id,
    actor_user_id: input.user_id,
    event_type: "hypothesis_created",
    title: "Hypothesis spec drafted",
    summary: validationErrors.length > 0 ? "The hypothesis spec needs clarification before it can be approved." : "A versioned hypothesis spec was drafted for approval.",
    payload: {
      hypothesis_id: hypothesisId,
      hypothesis_version_id: version.hypothesis_version_id,
      validation_errors: validationErrors,
    },
    created_at: now,
  });
  await accountService.incrementUsage(input.account_id, "hypothesis");
  await accountService.incrementUsage(input.account_id, "assistant");
  return version;
}

export async function approveHypothesisVersion(input: {
  program_id: string;
  hypothesis_version_id: string;
  account_id: string;
  user_id: string;
}) {
  const program = await researchProgramRepository.findSummaryById(input.program_id);
  if (!program || program.account_id !== input.account_id) throw new Error("program_not_found");
  const version = await researchProgramRepository.findHypothesisVersion(input.hypothesis_version_id);
  if (!version || version.program_id !== program.program_id || version.account_id !== input.account_id) throw new Error("hypothesis_version_not_found");
  if (version.validation_errors.length > 0) throw new Error("hypothesis_spec_invalid");
  const now = new Date().toISOString();
  await researchProgramRepository.approveHypothesisVersion({
    approval_id: randomUUID(),
    hypothesis_version_id: version.hypothesis_version_id,
    hypothesis_id: version.hypothesis_id,
    program_id: program.program_id,
    account_id: input.account_id,
    actor_user_id: input.user_id,
    from_status: version.status,
    to_status: "approved_for_strategy_generation",
    note: "User approved hypothesis version for strategy-spec generation.",
    created_at: now,
  });
  await researchProgramRepository.recordEvent({
    event_id: randomUUID(),
    program_id: program.program_id,
    account_id: input.account_id,
    actor_user_id: input.user_id,
    event_type: "hypothesis_approved",
    title: "Hypothesis approved",
    summary: "The hypothesis version is approved for strategy-spec generation.",
    payload: {
      hypothesis_id: version.hypothesis_id,
      hypothesis_version_id: version.hypothesis_version_id,
    },
    created_at: now,
  });
}

export async function saveManualHypothesisVersion(input: {
  program_id: string;
  hypothesis_version_id: string;
  account_id: string;
  user_id: string;
  spec: HypothesisSpecV1;
}) {
  const program = await researchProgramRepository.findSummaryById(input.program_id);
  if (!program || program.account_id !== input.account_id) throw new Error("program_not_found");
  const previous = await researchProgramRepository.findHypothesisVersion(input.hypothesis_version_id);
  if (!previous || previous.program_id !== program.program_id || previous.account_id !== input.account_id) throw new Error("hypothesis_version_not_found");
  const now = new Date().toISOString();
  const validationErrors = validateHypothesisSpec(input.spec);
  const status = validationErrors.length > 0 ? "needs_clarification" : "draft";
  const versions = await researchProgramRepository.listHypothesisVersions(program.program_id);
  const version = await researchProgramRepository.saveHypothesis({
    hypothesis: {
      hypothesis_id: previous.hypothesis_id,
      program_id: program.program_id,
      account_id: input.account_id,
      title: input.spec.title,
      status,
      active_version_id: previous.status === "approved_for_strategy_generation" ? previous.hypothesis_version_id : undefined,
      created_by_user_id: previous.created_by_user_id,
      created_at: previous.created_at,
      updated_at: now,
    },
    version: {
      hypothesis_version_id: randomUUID(),
      hypothesis_id: previous.hypothesis_id,
      program_id: program.program_id,
      account_id: input.account_id,
      version: versions.length + 1,
      status,
      source_brief_id: previous.source_brief_id,
      spec: { ...input.spec, generated_by: "user", generated_at: now },
      validation_errors: validationErrors,
      created_by_user_id: input.user_id,
      created_at: now,
    },
    approval: {
      approval_id: randomUUID(),
      hypothesis_version_id: previous.hypothesis_version_id,
      hypothesis_id: previous.hypothesis_id,
      program_id: program.program_id,
      account_id: input.account_id,
      actor_user_id: input.user_id,
      from_status: previous.status,
      to_status: status,
      note: "Manual hypothesis edit saved as a new version.",
      created_at: now,
    },
  });
  await researchProgramRepository.recordEvent({
    event_id: randomUUID(),
    program_id: program.program_id,
    account_id: input.account_id,
    actor_user_id: input.user_id,
    event_type: "hypothesis_created",
    title: "Hypothesis spec edited",
    summary: validationErrors.length > 0 ? "Manual edit was saved with validation issues." : "Manual edit was saved as a new valid draft.",
    payload: {
      hypothesis_id: previous.hypothesis_id,
      hypothesis_version_id: version.hypothesis_version_id,
      validation_errors: validationErrors,
    },
    created_at: now,
  });
  return version;
}

export async function createStrategySpecFromHypothesis(input: {
  program_id: string;
  hypothesis_version_id: string;
  account_id: string;
  user_id: string;
}) {
  const program = await researchProgramRepository.findSummaryById(input.program_id);
  if (!program || program.account_id !== input.account_id) throw new Error("program_not_found");
  assertAssistantAccepting();
  await assertAssistantCallAllowed(input.account_id);
  const hypothesis = await researchProgramRepository.findHypothesisVersion(input.hypothesis_version_id);
  if (!hypothesis || hypothesis.program_id !== program.program_id || hypothesis.account_id !== input.account_id) throw new Error("hypothesis_version_not_found");
  if (hypothesis.status !== "approved_for_strategy_generation") throw new Error("hypothesis_not_approved");
  if (hypothesis.validation_errors.length > 0) throw new Error("hypothesis_spec_invalid");

  const now = new Date().toISOString();
  const existing = await researchProgramRepository.listStrategySpecs(program.program_id);
  const spec = buildStrategySpecFromHypothesis({
    hypothesisVersionId: hypothesis.hypothesis_version_id,
    hypothesis: hypothesis.spec,
    strategySpecId: randomUUID(),
    generatedAt: now,
  });
  const validationErrors = validateStrategySpec(spec);
  const record = await researchProgramRepository.saveStrategySpec({
    strategy_spec_record_id: randomUUID(),
    program_id: program.program_id,
    account_id: input.account_id,
    hypothesis_version_id: hypothesis.hypothesis_version_id,
    version: existing.length + 1,
    status: validationErrors.length > 0 ? "needs_revision" : "draft",
    spec,
    validation_errors: validationErrors,
    created_by_user_id: input.user_id,
    created_at: now,
  });
  await researchProgramRepository.recordEvent({
    event_id: randomUUID(),
    program_id: program.program_id,
    account_id: input.account_id,
    actor_user_id: input.user_id,
    event_type: "strategy_spec_created",
    title: "Strategy spec proposed",
    summary: validationErrors.length > 0 ? "The proposed strategy spec needs revision before approval." : "A strategy spec proposal was generated for user review.",
    payload: {
      strategy_spec_record_id: record.strategy_spec_record_id,
      hypothesis_version_id: hypothesis.hypothesis_version_id,
      validation_errors: validationErrors,
      assistant_assumptions: spec.assistant_assumptions,
    },
    created_at: now,
  });
  await accountService.incrementUsage(input.account_id, "assistant");
  return record;
}

export async function approveStrategySpec(input: {
  program_id: string;
  strategy_spec_record_id: string;
  account_id: string;
  user_id: string;
}) {
  const program = await researchProgramRepository.findSummaryById(input.program_id);
  if (!program || program.account_id !== input.account_id) throw new Error("program_not_found");
  const spec = await researchProgramRepository.findStrategySpec(input.strategy_spec_record_id);
  if (!spec || spec.program_id !== program.program_id || spec.account_id !== input.account_id) throw new Error("strategy_spec_not_found");
  if (spec.validation_errors.length > 0) throw new Error("strategy_spec_invalid");
  const now = new Date().toISOString();
  await researchProgramRepository.approveStrategySpec({
    strategy_spec_record_id: spec.strategy_spec_record_id,
    account_id: input.account_id,
    user_id: input.user_id,
    approved_at: now,
  });
  await researchProgramRepository.recordEvent({
    event_id: randomUUID(),
    program_id: program.program_id,
    account_id: input.account_id,
    actor_user_id: input.user_id,
    event_type: "strategy_spec_approved",
    title: "Strategy spec approved",
    summary: "The strategy spec is approved for execution queue wiring in the next phase.",
    payload: {
      strategy_spec_record_id: spec.strategy_spec_record_id,
      hypothesis_version_id: spec.hypothesis_version_id,
    },
    created_at: now,
  });
}

export async function saveManualStrategySpec(input: {
  program_id: string;
  strategy_spec_record_id: string;
  account_id: string;
  user_id: string;
  spec: StrategySpecV1;
}) {
  const program = await researchProgramRepository.findSummaryById(input.program_id);
  if (!program || program.account_id !== input.account_id) throw new Error("program_not_found");
  const previous = await researchProgramRepository.findStrategySpec(input.strategy_spec_record_id);
  if (!previous || previous.program_id !== program.program_id || previous.account_id !== input.account_id) throw new Error("strategy_spec_not_found");
  const now = new Date().toISOString();
  const spec: StrategySpecV1 = { ...input.spec, generated_by: "user", generated_at: now, user_approval_required: true };
  const validationErrors = validateStrategySpec(spec);
  const existing = await researchProgramRepository.listStrategySpecs(program.program_id);
  const record = await researchProgramRepository.saveStrategySpec({
    strategy_spec_record_id: randomUUID(),
    program_id: program.program_id,
    account_id: input.account_id,
    hypothesis_version_id: previous.hypothesis_version_id,
    version: existing.length + 1,
    status: validationErrors.length > 0 ? "needs_revision" : "draft",
    spec,
    validation_errors: validationErrors,
    created_by_user_id: input.user_id,
    created_at: now,
  });
  await researchProgramRepository.recordEvent({
    event_id: randomUUID(),
    program_id: program.program_id,
    account_id: input.account_id,
    actor_user_id: input.user_id,
    event_type: "strategy_spec_created",
    title: "Strategy spec edited",
    summary: validationErrors.length > 0 ? "Manual edit was saved with validation issues." : "Manual edit was saved as a new valid draft.",
    payload: {
      strategy_spec_record_id: record.strategy_spec_record_id,
      validation_errors: validationErrors,
    },
    created_at: now,
  });
  return record;
}

export async function createExperimentPlanFromStrategySpec(input: {
  program_id: string;
  strategy_spec_record_id: string;
  account_id: string;
  user_id: string;
}) {
  const program = await researchProgramRepository.findSummaryById(input.program_id);
  if (!program || program.account_id !== input.account_id) throw new Error("program_not_found");
  assertAssistantAccepting();
  await assertAssistantCallAllowed(input.account_id);
  const strategy = await researchProgramRepository.findStrategySpec(input.strategy_spec_record_id);
  if (!strategy || strategy.program_id !== program.program_id || strategy.account_id !== input.account_id) throw new Error("strategy_spec_not_found");
  if (strategy.status !== "approved_for_execution") throw new Error("strategy_spec_not_approved");
  if (strategy.validation_errors.length > 0) throw new Error("strategy_spec_invalid");

  const now = new Date().toISOString();
  const experimentPlanId = randomUUID();
  const plan = buildExperimentPlanFromStrategySpec({ planId: experimentPlanId, strategySpec: strategy.spec });
  const validationErrors = validateExperimentPlan(plan);
  const record = await researchProgramRepository.saveExperimentPlan({
    plan: {
      experiment_plan_id: experimentPlanId,
      program_id: program.program_id,
      account_id: input.account_id,
      strategy_spec_record_id: strategy.strategy_spec_record_id,
      hypothesis_version_id: strategy.hypothesis_version_id,
      status: validationErrors.length > 0 ? "draft" : "draft",
      plan,
      validation_errors: validationErrors,
      created_by_user_id: input.user_id,
      created_at: now,
    },
    items: plan.items.map((item) => ({
      experiment_plan_item_id: randomUUID(),
      experiment_plan_id: experimentPlanId,
      program_id: program.program_id,
      account_id: input.account_id,
      item_key: item.item_id,
      experiment_type: item.experiment_type,
      title: item.title,
      status: item.enabled ? "draft" : "disabled",
      priority: item.priority,
      required_datasets: item.required_datasets,
      runtime_budget: item.runtime_budget,
      config_patch: item.config_patch,
      falsification_question: item.falsification_question,
      created_at: now,
    })),
  });
  await researchProgramRepository.recordEvent({
    event_id: randomUUID(),
    program_id: program.program_id,
    account_id: input.account_id,
    actor_user_id: input.user_id,
    event_type: "experiment_plan_created",
    title: "Experiment plan drafted",
    summary: validationErrors.length > 0 ? "The experiment plan needs repair before approval." : "A falsification plan was drafted from the approved strategy spec.",
    payload: {
      experiment_plan_id: experimentPlanId,
      strategy_spec_record_id: strategy.strategy_spec_record_id,
      item_count: plan.items.length,
      validation_errors: validationErrors,
    },
    created_at: now,
  });
  await accountService.incrementUsage(input.account_id, "assistant");
  return record;
}

export async function approveExperimentPlan(input: {
  program_id: string;
  experiment_plan_id: string;
  account_id: string;
  user_id: string;
}) {
  const program = await researchProgramRepository.findSummaryById(input.program_id);
  if (!program || program.account_id !== input.account_id) throw new Error("program_not_found");
  assertQueueAccepting("experiment");
  const plan = await researchProgramRepository.findExperimentPlan(input.experiment_plan_id);
  if (!plan || plan.program_id !== program.program_id || plan.account_id !== input.account_id) throw new Error("experiment_plan_not_found");
  if (plan.validation_errors.length > 0) throw new Error("experiment_plan_invalid");
  const now = new Date().toISOString();
  await researchProgramRepository.approveExperimentPlan({
    experiment_plan_id: plan.experiment_plan_id,
    account_id: input.account_id,
    user_id: input.user_id,
    approved_at: now,
  });
  await researchProgramRepository.recordEvent({
    event_id: randomUUID(),
    program_id: program.program_id,
    account_id: input.account_id,
    actor_user_id: input.user_id,
    event_type: "experiment_plan_approved",
    title: "Experiment plan approved",
    summary: "The falsification plan is approved and can now be queued.",
    payload: { experiment_plan_id: plan.experiment_plan_id },
    created_at: now,
  });
}

export async function queueExperimentPlan(input: {
  program_id: string;
  experiment_plan_id: string;
  account_id: string;
  user_id: string;
}) {
  const program = await researchProgramRepository.findSummaryById(input.program_id);
  if (!program || program.account_id !== input.account_id) throw new Error("program_not_found");
  const plan = await researchProgramRepository.findExperimentPlan(input.experiment_plan_id);
  if (!plan || plan.program_id !== program.program_id || plan.account_id !== input.account_id) throw new Error("experiment_plan_not_found");
  if (plan.status !== "approved") throw new Error("experiment_plan_not_approved");
  if (plan.validation_errors.length > 0) throw new Error("experiment_plan_invalid");
  const items = (await researchProgramRepository.listExperimentPlanItems(program.program_id))
    .filter((item) => item.experiment_plan_id === plan.experiment_plan_id && item.status === "draft");
  const requestedUnits = items.reduce((sum, item) => sum + item.runtime_budget.max_variants, 0);
  const { state, activeJobs } = await assertExperimentQueueAllowed({
    account_id: input.account_id,
    requested_jobs: items.length,
    requested_compute_units: requestedUnits,
  });
  const remainingQueueSlots = Math.max(0, state.entitlements.queued_experiments_limit - activeJobs.length);
  const queuedItems = items.slice(0, remainingQueueSlots);
  if (queuedItems.length === 0) throw new Error("experiment_queue_limit_reached");
  const queuedUnits = queuedItems.reduce((sum, item) => sum + item.runtime_budget.max_variants, 0);
  const now = new Date().toISOString();
  const jobs = queuedItems.map((item) => ({
    experiment_job_id: randomUUID(),
    experiment_plan_item_id: item.experiment_plan_item_id,
    experiment_plan_id: plan.experiment_plan_id,
    program_id: program.program_id,
    account_id: input.account_id,
    status: "queued" as const,
    priority: item.priority,
    progress_pct: 0,
    current_step: "Queued for B6 execution worker",
    retry_count: 0,
    max_attempts: 3,
    available_at: now,
    created_at: now,
    updated_at: now,
  }));
  await researchProgramRepository.queueExperimentJobs({
    experiment_plan_id: plan.experiment_plan_id,
    account_id: input.account_id,
    queued_at: now,
    jobs,
    events: jobs.map((job) => ({
      experiment_job_event_id: randomUUID(),
      experiment_job_id: job.experiment_job_id,
      experiment_plan_id: job.experiment_plan_id,
      program_id: program.program_id,
      account_id: input.account_id,
      event_type: "queued",
      message: "Experiment job queued for B6 execution.",
      payload: {
        max_concurrent: state.entitlements.concurrent_experiments_limit,
        plan_id: state.account.plan_id,
        compute_units_reserved: queuedUnits,
      },
      actor_user_id: input.user_id,
      created_at: now,
    })),
  });
  await researchProgramRepository.recordEvent({
    event_id: randomUUID(),
    program_id: program.program_id,
    account_id: input.account_id,
    actor_user_id: input.user_id,
    event_type: "experiment_queued",
    title: "Experiments queued",
    summary: `${jobs.length} falsification experiment${jobs.length === 1 ? "" : "s"} queued for execution.`,
    payload: { experiment_plan_id: plan.experiment_plan_id, job_count: jobs.length },
    created_at: now,
  });
  await accountService.incrementUsage(input.account_id, "experiment", jobs.length);
  await accountService.incrementUsage(input.account_id, "experiment_compute", queuedUnits);
  return { queued_count: jobs.length, jobs };
}

export async function updateExperimentJobControl(input: {
  job_id: string;
  account_id: string;
  user_id: string;
  action: "pause" | "cancel" | "retry" | "priority";
  priority?: number;
}) {
  const job = await researchProgramRepository.findExperimentJob(input.job_id);
  if (!job || job.account_id !== input.account_id) throw new Error("experiment_job_not_found");
  const now = new Date().toISOString();
  const eventBase = {
    experiment_job_event_id: randomUUID(),
    experiment_job_id: job.experiment_job_id,
    experiment_plan_id: job.experiment_plan_id,
    program_id: job.program_id,
    account_id: job.account_id,
    actor_user_id: input.user_id,
    created_at: now,
  };
  if (input.action === "pause") {
    await researchProgramRepository.updateExperimentJob({
      job_id: job.experiment_job_id,
      account_id: input.account_id,
      patch: { status: "paused", current_step: "Paused by user", updated_at: now },
      event: { ...eventBase, event_type: "paused", message: "Experiment job paused.", payload: {} },
    });
  } else if (input.action === "cancel") {
    await researchProgramRepository.updateExperimentJob({
      job_id: job.experiment_job_id,
      account_id: input.account_id,
      patch: { status: "canceled", current_step: "Canceled by user", finished_at: now, updated_at: now },
      event: { ...eventBase, event_type: "canceled", message: "Experiment job canceled.", payload: {} },
    });
  } else if (input.action === "retry") {
    await researchProgramRepository.updateExperimentJob({
      job_id: job.experiment_job_id,
      account_id: input.account_id,
      patch: { status: "queued", retry_count: job.retry_count + 1, current_step: "Queued for retry", available_at: now, last_error: undefined, updated_at: now },
      event: { ...eventBase, event_type: "retried", message: "Experiment job queued for retry.", payload: { retry_count: job.retry_count + 1 } },
    });
  } else {
    const priority = Math.max(0, Math.min(100, Number(input.priority ?? job.priority)));
    await researchProgramRepository.updateExperimentJob({
      job_id: job.experiment_job_id,
      account_id: input.account_id,
      patch: { priority, updated_at: now },
      event: { ...eventBase, event_type: "priority_changed", message: "Experiment job priority changed.", payload: { priority } },
    });
  }
}
