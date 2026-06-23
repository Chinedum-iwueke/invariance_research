import { createHash, randomUUID } from "node:crypto";
import { accountService } from "@/lib/server/accounts/service";
import { assertAssistantCallAllowed } from "@/lib/server/entitlements/research-policy";
import { getResearchAssistantConfig } from "@/lib/server/llm/chat-provider";
import { assertAssistantAccepting } from "@/lib/server/ops/operations-policy";
import { researchProgramRepository } from "@/lib/server/research-programs/repository";
import { researchCopilotRepository } from "@/lib/server/research-copilot/repository";
import { COPILOT_PROMPT_VERSION, inferCopilotMode, runCopilotReasoning } from "@/lib/server/research-copilot/reasoning";
import { COPILOT_TOOL_VERSION, executeCopilotReadTool } from "@/lib/server/research-copilot/tools";
import type { MessagePart, ResearchConversation, ResearchMessage, ResearchProposal } from "@/lib/server/research-copilot/models";
import { ingestResearchSource, ingestYouTubeSource } from "@/lib/server/research-copilot/source-ingestion";

async function requireProgram(programId: string, accountId: string) {
  const program = await researchProgramRepository.findSummaryById(programId);
  if (!program || program.account_id !== accountId) throw new Error("program_not_found");
  return program;
}

export async function getOrCreateProgramConversation(input: { programId: string; accountId: string; userId: string }) {
  const program = await requireProgram(input.programId, input.accountId);
  const existing = await researchCopilotRepository.findDefaultConversation(input.programId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const conversation: ResearchConversation = {
    conversation_id: randomUUID(), program_id: input.programId, account_id: input.accountId, created_by_user_id: input.userId,
    title: `${program.title} research thread`, status: "active", created_at: now, updated_at: now,
  };
  await researchCopilotRepository.saveConversation(conversation);
  const welcome: ResearchMessage = {
    message_id: randomUUID(), conversation_id: conversation.conversation_id, program_id: input.programId, account_id: input.accountId,
    role: "assistant", content: "Bring me an intuition, detailed strategy description, transcript, paper, or completed artifact. I will help turn it into a falsifiable research object and keep assumptions visible before anything can run.",
    parts: [{ type: "text", text: "Research starts in plain language. Confirmed objects, not chat prose, control experiments." }], status: "complete", created_at: now,
  };
  await researchCopilotRepository.saveMessage(welcome);
  return conversation;
}

export async function getProgramConversationDetail(input: { programId: string; accountId: string; userId: string }) {
  await getOrCreateProgramConversation(input);
  return researchCopilotRepository.getDetail(input.programId);
}

function proposalHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function sendProgramCopilotMessage(input: { programId: string; accountId: string; userId: string; content: string; sourceIds?: string[]; signal?: AbortSignal }) {
  const content = input.content.trim();
  if (content.length < 2) throw new Error("message_required");
  if (content.length > 20_000) throw new Error("message_too_large");
  assertAssistantAccepting();
  await assertAssistantCallAllowed(input.accountId);
  const program = await requireProgram(input.programId, input.accountId);
  const conversation = await getOrCreateProgramConversation(input);
  const now = new Date().toISOString();
  const userMessage: ResearchMessage = {
    message_id: randomUUID(), conversation_id: conversation.conversation_id, program_id: input.programId, account_id: input.accountId,
    role: "user", content, parts: [{ type: "text", text: content }], status: "complete", created_by_user_id: input.userId, created_at: now,
  };
  await researchCopilotRepository.saveMessage(userMessage);
  await researchCopilotRepository.touchConversation(conversation.conversation_id, now);
  const config = getResearchAssistantConfig();
  const turnId = randomUUID();
  await researchCopilotRepository.saveTurn({
    turn_id: turnId, conversation_id: conversation.conversation_id, program_id: input.programId, account_id: input.accountId,
    user_message_id: userMessage.message_id, provider: config.enabled ? config.provider : "deterministic", prompt_version: COPILOT_PROMPT_VERSION,
    tool_version: COPILOT_TOOL_VERSION, status: "processing", created_at: now,
  });

  try {
    const detail = await researchCopilotRepository.getDetail(input.programId);
    if (!detail) throw new Error("conversation_not_found");
    const sourceIds = new Set(input.sourceIds ?? []);
    const selectedChunks = detail.source_chunks.filter((chunk) => sourceIds.size === 0 ? false : sourceIds.has(chunk.source_id));
    const hasArtifacts = program.attached_analysis_count > 0 || detail.proposals.length > 0;
    const mode = inferCopilotMode({ message: content, sourceIds: [...sourceIds], hasArtifacts });
    const [programState, sources, artifacts] = await Promise.all([
      executeCopilotReadTool({ toolName: "read_program_state", turnId, conversationId: conversation.conversation_id, programId: input.programId, accountId: input.accountId }),
      executeCopilotReadTool({ toolName: "list_program_sources", turnId, conversationId: conversation.conversation_id, programId: input.programId, accountId: input.accountId }),
      executeCopilotReadTool({ toolName: "list_program_artifacts", turnId, conversationId: conversation.conversation_id, programId: input.programId, accountId: input.accountId }),
    ]);
    const contextMessages = detail.messages.slice(-20);
    await researchCopilotRepository.saveContextSnapshot({
      context_snapshot_id: randomUUID(), turn_id: turnId, conversation_id: conversation.conversation_id, program_id: input.programId, account_id: input.accountId,
      included_message_ids: contextMessages.map((message) => message.message_id), included_source_chunks: selectedChunks.map((chunk) => chunk.chunk_id),
      included_artifact_ids: (artifacts as Array<{ artifact_id?: string }>).flatMap((item) => item.artifact_id ? [item.artifact_id] : []),
      token_estimate: Math.ceil((contextMessages.reduce((sum, message) => sum + message.content.length, 0) + selectedChunks.reduce((sum, chunk) => sum + chunk.content.length, 0)) / 4),
      policy_version: "copilot_context_policy_v1", created_at: now,
    });
    const result = await runCopilotReasoning({ message: content, mode, messages: contextMessages, sources: detail.sources, sourceChunks: selectedChunks, toolContext: { programState, sources, artifacts }, signal: input.signal });
    const assistantMessageId = randomUUID();
    const parts: MessagePart[] = [
      { type: "text", text: result.output.response },
      ...result.output.warnings.map((warning): MessagePart => ({ type: "warning", code: warning.code, message: warning.message })),
    ];
    const proposals: ResearchProposal[] = result.output.candidates.map((candidate, index) => {
      const proposalId = randomUUID();
      parts.push({ type: "proposal", proposal_id: proposalId, proposal_type: "candidate_hypothesis" });
      parts.push({ type: "approval_request", proposal_id: proposalId, label: "Confirm this candidate before it becomes a research object." });
      for (const citation of candidate.source_citations) parts.push({ type: "source_citation", source_id: citation.source_id, chunk_id: citation.chunk_id, label: citation.quote ?? "Source evidence" });
      return {
        proposal_id: proposalId, conversation_id: conversation.conversation_id, program_id: input.programId, account_id: input.accountId,
        source_message_id: assistantMessageId, proposal_type: "candidate_hypothesis", status: "proposed", title: candidate.claim.slice(0, 140), payload: candidate,
        provenance: Object.fromEntries(Object.entries(result.output.research_state).map(([field, state]) => [field, { state: state.provenance, confidence: state.confidence, source_ids: candidate.source_citations.map((citation) => citation.source_id) }])),
        version: index + 1, content_hash: proposalHash(candidate), created_at: new Date().toISOString(),
      };
    });
    const assistantContent = `${result.output.response}${result.output.next_question ? `\n\n${result.output.next_question}` : ""}`;
    const assistantMessage: ResearchMessage = {
      message_id: assistantMessageId, conversation_id: conversation.conversation_id, program_id: input.programId, account_id: input.accountId,
      role: "assistant", content: assistantContent, parts, status: "complete", reply_to_message_id: userMessage.message_id, created_at: new Date().toISOString(),
    };
    await researchCopilotRepository.saveMessage(assistantMessage);
    for (const proposal of proposals) await researchCopilotRepository.saveProposal(proposal);
    await researchCopilotRepository.completeTurn(turnId, {
      assistant_message_id: assistantMessageId, provider: result.provider, model: result.model, status: "completed", mode: result.output.mode,
      prompt_tokens: result.prompt_tokens, completion_tokens: result.completion_tokens, duration_ms: result.duration_ms, completed_at: new Date().toISOString(),
    });
    await accountService.incrementUsage(input.accountId, "assistant");
    return { message: assistantMessage, proposals, mode: result.output.mode, research_state: result.output.research_state };
  } catch (error) {
    const code = error instanceof Error ? error.message : "copilot_turn_failed";
    const canceled = input.signal?.aborted || /abort/i.test(code);
    await researchCopilotRepository.completeTurn(turnId, { status: canceled ? "canceled" : "failed", error_code: canceled ? "turn_canceled" : code, completed_at: new Date().toISOString() });
    throw error;
  }
}

export async function decideProgramProposal(input: { programId: string; accountId: string; userId: string; proposalId: string; decision: "confirmed" | "rejected" }) {
  await requireProgram(input.programId, input.accountId);
  await researchCopilotRepository.decideProposal({ proposalId: input.proposalId, accountId: input.accountId, actorUserId: input.userId, decision: input.decision, decisionId: randomUUID(), createdAt: new Date().toISOString() });
}

export async function uploadProgramSource(input: Parameters<typeof ingestResearchSource>[0]) {
  await requireProgram(input.programId, input.accountId);
  return ingestResearchSource(input);
}

export async function addProgramYouTubeSource(input: Parameters<typeof ingestYouTubeSource>[0]) {
  await requireProgram(input.programId, input.accountId);
  return ingestYouTubeSource(input);
}
