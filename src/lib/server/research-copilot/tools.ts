import { createHash, randomUUID } from "node:crypto";
import { researchProgramRepository } from "@/lib/server/research-programs/repository";
import { researchCopilotRepository } from "@/lib/server/research-copilot/repository";

export const COPILOT_TOOL_VERSION = "research_copilot_tools_v1";

const READ_TOOLS = new Set([
  "list_program_sources",
  "list_program_artifacts",
  "read_program_state",
]);

export const CONFIRMATION_REQUIRED_TOOLS = new Set([
  "create_candidate_hypotheses",
  "create_research_note",
  "create_next_experiment_proposal",
]);

export const FORBIDDEN_CHAT_TOOLS = new Set([
  "approve_hypothesis",
  "approve_strategy_spec",
  "queue_experiment",
  "create_deployment",
  "place_order",
  "cancel_order",
]);

function idempotencyKey(turnId: string, name: string, args: unknown) {
  return createHash("sha256").update(`${turnId}:${name}:${JSON.stringify(args)}`).digest("hex");
}

export async function executeCopilotReadTool(input: {
  toolName: string;
  args?: Record<string, unknown>;
  turnId: string;
  conversationId: string;
  programId: string;
  accountId: string;
}) {
  const createdAt = new Date().toISOString();
  const args = input.args ?? {};
  if (!READ_TOOLS.has(input.toolName)) {
    const decision = CONFIRMATION_REQUIRED_TOOLS.has(input.toolName) ? "confirmation_required" : "denied";
    await researchCopilotRepository.saveToolCall({
      tool_call_id: randomUUID(), turn_id: input.turnId, conversation_id: input.conversationId, program_id: input.programId,
      account_id: input.accountId, tool_name: input.toolName, arguments: args, authorization_decision: decision,
      status: "denied", idempotency_key: idempotencyKey(input.turnId, input.toolName, args), error_code: decision, created_at: createdAt, completed_at: createdAt,
    });
    throw new Error(decision);
  }

  const program = await researchProgramRepository.findSummaryById(input.programId);
  if (!program || program.account_id !== input.accountId) throw new Error("program_not_found");
  let result: unknown;
  if (input.toolName === "list_program_sources") {
    result = (await researchCopilotRepository.listSources(input.programId)).map((source) => ({
      source_id: source.source_id, type: source.source_type, title: source.title, status: source.status, metadata: source.metadata,
    }));
  } else if (input.toolName === "list_program_artifacts") {
    result = (await researchProgramRepository.listArtifacts(input.programId)).map((artifact) => ({
      program_artifact_id: artifact.program_artifact_id, artifact_id: artifact.artifact_id, analysis_id: artifact.analysis_id, role: artifact.artifact_role,
    }));
  } else {
    const [hypotheses, specs, plans, jobs] = await Promise.all([
      researchProgramRepository.listHypothesisVersions(input.programId),
      researchProgramRepository.listStrategySpecs(input.programId),
      researchProgramRepository.listExperimentPlans(input.programId),
      researchProgramRepository.listExperimentJobs(input.programId),
    ]);
    result = {
      program: { title: program.title, thesis: program.thesis, market: program.market, universe: program.asset_universe, timeframe: program.timeframe },
      hypotheses: hypotheses.map((item) => ({ id: item.hypothesis_version_id, title: item.spec.title, status: item.status })),
      strategy_specs: specs.map((item) => ({ id: item.strategy_spec_record_id, status: item.status, family: item.spec.strategy_family })),
      experiment_plans: plans.map((item) => ({ id: item.experiment_plan_id, status: item.status })),
      experiment_jobs: jobs.map((item) => ({ id: item.experiment_job_id, status: item.status, step: item.current_step, error: item.last_error })),
    };
  }

  await researchCopilotRepository.saveToolCall({
    tool_call_id: randomUUID(), turn_id: input.turnId, conversation_id: input.conversationId, program_id: input.programId,
    account_id: input.accountId, tool_name: input.toolName, arguments: args, result, authorization_decision: "allowed", status: "completed",
    idempotency_key: idempotencyKey(input.turnId, input.toolName, args), created_at: createdAt, completed_at: new Date().toISOString(),
  });
  return result;
}

export function assertCopilotToolPolicy(toolName: string) {
  if (FORBIDDEN_CHAT_TOOLS.has(toolName)) throw new Error("high_impact_action_requires_separate_workflow");
  if (CONFIRMATION_REQUIRED_TOOLS.has(toolName)) return "confirmation_required" as const;
  if (READ_TOOLS.has(toolName)) return "allowed" as const;
  return "denied" as const;
}
