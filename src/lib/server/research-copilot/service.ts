import { createHash, randomUUID } from "node:crypto";
import { accountService } from "@/lib/server/accounts/service";
import { assertAssistantCallAllowed } from "@/lib/server/entitlements/research-policy";
import { getResearchAssistantConfig } from "@/lib/server/llm/chat-provider";
import { assertAssistantAccepting } from "@/lib/server/ops/operations-policy";
import { researchProgramRepository } from "@/lib/server/research-programs/repository";
import { researchCopilotRepository } from "@/lib/server/research-copilot/repository";
import {
  COPILOT_PROMPT_VERSION,
  inferCopilotMode,
  runCopilotReasoning,
} from "@/lib/server/research-copilot/reasoning";
import {
  COPILOT_TOOL_VERSION,
  executeCopilotReadTool,
} from "@/lib/server/research-copilot/tools";
import type {
  MessagePart,
  ResearchConversation,
  ResearchMessage,
  ResearchProposal,
} from "@/lib/server/research-copilot/models";
import {
  ingestResearchSource,
  ingestYouTubeSource,
} from "@/lib/server/research-copilot/source-ingestion";
import { artifactContextForTurn } from "@/lib/server/research-c2/service";

async function requireProgram(programId: string, accountId: string) {
  const program = await researchProgramRepository.findSummaryById(programId);
  if (!program || program.account_id !== accountId)
    throw new Error("program_not_found");
  return program;
}

export async function getOrCreateProgramConversation(input: {
  programId: string;
  accountId: string;
  userId: string;
}) {
  const program = await requireProgram(input.programId, input.accountId);
  const existing = await researchCopilotRepository.findDefaultConversation(
    input.programId,
  );
  if (existing) return existing;
  const now = new Date().toISOString();
  const conversation: ResearchConversation = {
    conversation_id: randomUUID(),
    program_id: input.programId,
    account_id: input.accountId,
    created_by_user_id: input.userId,
    title: `${program.title} research thread`,
    status: "active",
    created_at: now,
    updated_at: now,
  };
  await researchCopilotRepository.saveConversation(conversation);
  const welcome: ResearchMessage = {
    message_id: randomUUID(),
    conversation_id: conversation.conversation_id,
    program_id: input.programId,
    account_id: input.accountId,
    role: "assistant",
    content:
      "Bring me an intuition, detailed strategy description, transcript, paper, or completed artifact. I will help turn it into a falsifiable research object and keep assumptions visible before anything can run.",
    parts: [
      {
        type: "text",
        text: "Research starts in plain language. Confirmed objects, not chat prose, control experiments.",
      },
    ],
    status: "complete",
    created_at: now,
  };
  await researchCopilotRepository.saveMessage(welcome);
  return conversation;
}

export async function getProgramConversationDetail(input: {
  programId: string;
  accountId: string;
  userId: string;
}) {
  await getOrCreateProgramConversation(input);
  return researchCopilotRepository.getDetail(input.programId);
}

function proposalHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function sendProgramCopilotMessage(input: {
  programId: string;
  accountId: string;
  userId: string;
  content: string;
  sourceIds?: string[];
  artifactIds?: string[];
  signal?: AbortSignal;
}) {
  const content = input.content.trim();
  if (content.length < 2) throw new Error("message_required");
  if (content.length > 20_000) throw new Error("message_too_large");
  assertAssistantAccepting();
  await assertAssistantCallAllowed(input.accountId);
  const program = await requireProgram(input.programId, input.accountId);
  const conversation = await getOrCreateProgramConversation(input);
  const now = new Date().toISOString();
  const userMessage: ResearchMessage = {
    message_id: randomUUID(),
    conversation_id: conversation.conversation_id,
    program_id: input.programId,
    account_id: input.accountId,
    role: "user",
    content,
    parts: [{ type: "text", text: content }],
    status: "complete",
    created_by_user_id: input.userId,
    created_at: now,
  };
  await researchCopilotRepository.saveMessage(userMessage);
  await researchCopilotRepository.touchConversation(
    conversation.conversation_id,
    now,
  );
  const config = getResearchAssistantConfig();
  const turnId = randomUUID();
  await researchCopilotRepository.saveTurn({
    turn_id: turnId,
    conversation_id: conversation.conversation_id,
    program_id: input.programId,
    account_id: input.accountId,
    user_message_id: userMessage.message_id,
    provider: config.enabled ? config.provider : "deterministic",
    prompt_version: COPILOT_PROMPT_VERSION,
    tool_version: COPILOT_TOOL_VERSION,
    status: "processing",
    created_at: now,
  });

  try {
    const detail = await researchCopilotRepository.getDetail(input.programId);
    if (!detail) throw new Error("conversation_not_found");
    const sourceIds = new Set(input.sourceIds ?? []);
    const selectedChunks = detail.source_chunks.filter((chunk) =>
      sourceIds.size === 0 ? false : sourceIds.has(chunk.source_id),
    );
    const hasArtifacts =
      program.attached_analysis_count > 0 || detail.proposals.length > 0;
    const mode = input.artifactIds?.length
      ? "artifact_analysis"
      : inferCopilotMode({
          message: content,
          sourceIds: [...sourceIds],
          hasArtifacts,
        });
    const [programState, sources, artifacts] = await Promise.all([
      executeCopilotReadTool({
        toolName: "read_program_state",
        turnId,
        conversationId: conversation.conversation_id,
        programId: input.programId,
        accountId: input.accountId,
      }),
      executeCopilotReadTool({
        toolName: "list_program_sources",
        turnId,
        conversationId: conversation.conversation_id,
        programId: input.programId,
        accountId: input.accountId,
      }),
      executeCopilotReadTool({
        toolName: "list_program_artifacts",
        turnId,
        conversationId: conversation.conversation_id,
        programId: input.programId,
        accountId: input.accountId,
      }),
    ]);
    const contextMessages = detail.messages.slice(-20);
    await researchCopilotRepository.saveContextSnapshot({
      context_snapshot_id: randomUUID(),
      turn_id: turnId,
      conversation_id: conversation.conversation_id,
      program_id: input.programId,
      account_id: input.accountId,
      included_message_ids: contextMessages.map(
        (message) => message.message_id,
      ),
      included_source_chunks: selectedChunks.map((chunk) => chunk.chunk_id),
      included_artifact_ids: [
        ...new Set([
          ...(input.artifactIds ?? []),
          ...(artifacts as Array<{ artifact_id?: string }>).flatMap((item) =>
            item.artifact_id ? [item.artifact_id] : [],
          ),
        ]),
      ],
      token_estimate: Math.ceil(
        (contextMessages.reduce(
          (sum, message) => sum + message.content.length,
          0,
        ) +
          selectedChunks.reduce(
            (sum, chunk) => sum + chunk.content.length,
            0,
          )) /
          4,
      ),
      policy_version: "copilot_context_policy_v1",
      created_at: now,
    });
    const artifactContext =
      mode === "artifact_analysis"
        ? await artifactContextForTurn({
            programId: input.programId,
            accountId: input.accountId,
            turnId,
            question: content,
            objectIds: input.artifactIds,
          })
        : undefined;
    const result = artifactContext
      ? {
          output: {
            schema_version: "research_copilot_turn_v1" as const,
            mode: "artifact_analysis" as const,
            response: "Canonical artifact query completed.",
            candidates: [],
            research_state: {},
            warnings: [],
          },
          provider: "canonical_artifact_query",
          model: "artifact_query_v1",
          duration_ms: 0,
          prompt_tokens: undefined,
          completion_tokens: undefined,
        }
      : await runCopilotReasoning({
          message: content,
          mode,
          messages: contextMessages,
          sources: detail.sources,
          sourceChunks: selectedChunks,
          toolContext: { programState, sources, artifacts, artifactContext },
          signal: input.signal,
        });
    const assistantMessageId = randomUUID();
    const citedAnswer = artifactContext?.answer as
      | undefined
      | {
          facts: Array<{ statement: string }>;
          inferences: Array<{ statement: string }>;
          recommendations: Array<{ statement: string }>;
          unknowns: Array<{ statement: string }>;
        };
    const artifactAnswerText = citedAnswer
      ? [
          citedAnswer.facts.length
            ? `Facts\n${citedAnswer.facts.map((item) => item.statement).join("\n")}`
            : "",
          citedAnswer.inferences.length
            ? `Inferences\n${citedAnswer.inferences.map((item) => item.statement).join("\n")}`
            : "",
          citedAnswer.recommendations.length
            ? `Recommendations\n${citedAnswer.recommendations.map((item) => item.statement).join("\n")}`
            : "",
          citedAnswer.unknowns.length
            ? `Unknowns\n${citedAnswer.unknowns.map((item) => item.statement).join("\n")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n")
      : undefined;
    const responseText = artifactAnswerText ?? result.output.response;
    const parts: MessagePart[] = [
      { type: "text", text: responseText },
      ...result.output.warnings.map(
        (warning): MessagePart => ({
          type: "warning",
          code: warning.code,
          message: warning.message,
        }),
      ),
      ...(artifactContext
        ? artifactContext.answer.citations.map(
            (citation): MessagePart => ({
              type: "artifact_citation",
              artifact_id: citation.object_id,
              label: `${artifactContext.result.query_type} evidence`,
              anchor: citation.anchor,
            }),
          )
        : []),
    ];
    const proposals: ResearchProposal[] = (
      mode === "artifact_analysis" ? [] : result.output.candidates
    ).map((candidate, index) => {
      const proposalId = randomUUID();
      parts.push({
        type: "proposal",
        proposal_id: proposalId,
        proposal_type: "candidate_hypothesis",
      });
      parts.push({
        type: "approval_request",
        proposal_id: proposalId,
        label: "Confirm this candidate before it becomes a research object.",
      });
      for (const citation of candidate.source_citations)
        parts.push({
          type: "source_citation",
          source_id: citation.source_id,
          chunk_id: citation.chunk_id,
          label: citation.quote ?? "Source evidence",
        });
      return {
        proposal_id: proposalId,
        conversation_id: conversation.conversation_id,
        program_id: input.programId,
        account_id: input.accountId,
        source_message_id: assistantMessageId,
        proposal_type: "candidate_hypothesis",
        status: "proposed",
        title: candidate.claim.slice(0, 140),
        payload: candidate,
        provenance: Object.fromEntries(
          Object.entries(result.output.research_state).map(([field, state]) => [
            field,
            {
              state: state.provenance,
              confidence: state.confidence,
              source_ids: candidate.source_citations.map(
                (citation) => citation.source_id,
              ),
            },
          ]),
        ),
        version: index + 1,
        content_hash: proposalHash(candidate),
        created_at: new Date().toISOString(),
      };
    });
    const assistantContent = `${responseText}${!artifactContext && result.output.next_question ? `\n\n${result.output.next_question}` : ""}`;
    const assistantMessage: ResearchMessage = {
      message_id: assistantMessageId,
      conversation_id: conversation.conversation_id,
      program_id: input.programId,
      account_id: input.accountId,
      role: "assistant",
      content: assistantContent,
      parts,
      status: "complete",
      reply_to_message_id: userMessage.message_id,
      created_at: new Date().toISOString(),
    };
    await researchCopilotRepository.saveMessage(assistantMessage);
    for (const proposal of proposals)
      await researchCopilotRepository.saveProposal(proposal);
    await researchCopilotRepository.completeTurn(turnId, {
      assistant_message_id: assistantMessageId,
      provider: result.provider,
      model: result.model,
      status: "completed",
      mode: result.output.mode,
      prompt_tokens: result.prompt_tokens,
      completion_tokens: result.completion_tokens,
      duration_ms: result.duration_ms,
      completed_at: new Date().toISOString(),
    });
    await accountService.incrementUsage(input.accountId, "assistant");
    return {
      message: assistantMessage,
      proposals,
      mode: result.output.mode,
      research_state: result.output.research_state,
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : "copilot_turn_failed";
    const canceled = input.signal?.aborted || /abort/i.test(code);
    await researchCopilotRepository.completeTurn(turnId, {
      status: canceled ? "canceled" : "failed",
      error_code: canceled ? "turn_canceled" : code,
      completed_at: new Date().toISOString(),
    });
    throw error;
  }
}

export async function decideProgramProposal(input: {
  programId: string;
  accountId: string;
  userId: string;
  proposalId: string;
  decision: "confirmed" | "rejected";
}) {
  await requireProgram(input.programId, input.accountId);
  const proposal = (
    await researchCopilotRepository.listProposals(input.programId)
  ).find(
    (item) =>
      item.proposal_id === input.proposalId &&
      item.account_id === input.accountId,
  );
  if (!proposal) throw new Error("proposal_not_found");
  await researchCopilotRepository.decideProposal({
    proposalId: input.proposalId,
    accountId: input.accountId,
    actorUserId: input.userId,
    decision: input.decision,
    decisionId: randomUUID(),
    createdAt: new Date().toISOString(),
  });
  if (
    input.decision === "confirmed" &&
    ["research_note", "next_experiment"].includes(proposal.proposal_type)
  ) {
    const now = new Date().toISOString();
    await researchProgramRepository.saveNote({
      note_id: randomUUID(),
      program_id: input.programId,
      account_id: input.accountId,
      author_user_id: input.userId,
      note_type:
        proposal.proposal_type === "research_note"
          ? "research_note"
          : "next_step",
      body: String(
        (proposal.payload as Record<string, unknown>).body ?? proposal.title,
      ),
      created_at: now,
      updated_at: now,
    });
  }
}

export async function proposeArtifactAnswerAction(input: {
  programId: string;
  accountId: string;
  userId: string;
  messageId: string;
  proposalType: "research_note" | "next_experiment";
}) {
  const conversation = await getOrCreateProgramConversation(input);
  const message = (
    await researchCopilotRepository.listMessages(conversation.conversation_id)
  ).find(
    (item) => item.message_id === input.messageId && item.role === "assistant",
  );
  if (
    !message ||
    !message.parts.some((part) => part.type === "artifact_citation")
  )
    throw new Error("cited_artifact_answer_required");
  const now = new Date().toISOString();
  const payload = {
    schema_version:
      input.proposalType === "research_note"
        ? "research_note_proposal_v1"
        : "next_experiment_proposal_v1",
    body: message.content,
    source_message_id: message.message_id,
    artifact_citations: message.parts.filter(
      (part) => part.type === "artifact_citation",
    ),
  };
  const proposal: ResearchProposal = {
    proposal_id: randomUUID(),
    conversation_id: conversation.conversation_id,
    program_id: input.programId,
    account_id: input.accountId,
    source_message_id: message.message_id,
    proposal_type: input.proposalType,
    status: "proposed",
    title:
      input.proposalType === "research_note"
        ? "Cited research note"
        : "Cited next experiment",
    payload,
    provenance: { body: { state: "extracted", confidence: 1, source_ids: [] } },
    version: 1,
    content_hash: proposalHash(payload),
    created_at: now,
  };
  await researchCopilotRepository.saveProposal(proposal);
  return proposal;
}

export async function uploadProgramSource(
  input: Parameters<typeof ingestResearchSource>[0],
) {
  await requireProgram(input.programId, input.accountId);
  return ingestResearchSource(input);
}

export async function addProgramYouTubeSource(
  input: Parameters<typeof ingestYouTubeSource>[0],
) {
  await requireProgram(input.programId, input.accountId);
  return ingestYouTubeSource(input);
}
