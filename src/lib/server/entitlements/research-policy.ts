import { accountService } from "@/lib/server/accounts/service";
import { researchProgramRepository } from "@/lib/server/research-programs/repository";

function activeJobStatus(status: string) {
  return status === "queued" || status === "paused" || status === "processing";
}

export async function assertProgramCreationAllowed(accountId: string) {
  const state = await accountService.getAccountState(accountId);
  if (!state) throw new Error("account_not_found");
  const programs = await researchProgramRepository.listSummaries(accountId);
  if (programs.filter((program) => program.status !== "archived").length >= state.entitlements.programs_limit) {
    throw new Error("program_limit_reached");
  }
  return state;
}

export async function assertHypothesisCreationAllowed(input: { account_id: string; program_id: string }) {
  const state = await accountService.getAccountState(input.account_id);
  if (!state) throw new Error("account_not_found");
  const detail = await researchProgramRepository.listHypothesisVersions(input.program_id);
  const active = detail.filter((hypothesis) => hypothesis.status !== "retired").length;
  if (active >= state.entitlements.active_hypotheses_limit) {
    throw new Error("active_hypothesis_limit_reached");
  }
  const usage = await accountService.getUsage(input.account_id);
  if (usage.assistant_calls >= state.entitlements.monthly_assistant_calls) {
    throw new Error("assistant_usage_limit_reached");
  }
  return state;
}

export async function assertAssistantCallAllowed(accountId: string) {
  const state = await accountService.getAccountState(accountId);
  if (!state) throw new Error("account_not_found");
  const usage = await accountService.getUsage(accountId);
  if (usage.assistant_calls >= state.entitlements.monthly_assistant_calls) {
    throw new Error("assistant_usage_limit_reached");
  }
  return state;
}

export async function assertExperimentQueueAllowed(input: {
  account_id: string;
  requested_jobs: number;
  requested_compute_units: number;
}) {
  const state = await accountService.getAccountState(input.account_id);
  if (!state) throw new Error("account_not_found");
  const usage = await accountService.getUsage(input.account_id);
  const existingJobs = await researchProgramRepository.listExperimentJobsForAccount(input.account_id);
  const activeJobs = existingJobs.filter((job) => activeJobStatus(job.status));
  const processingJobs = existingJobs.filter((job) => job.status === "processing");

  if (activeJobs.length + input.requested_jobs > state.entitlements.queued_experiments_limit) {
    throw new Error("experiment_queue_limit_reached");
  }
  if (processingJobs.length >= state.entitlements.concurrent_experiments_limit) {
    throw new Error("experiment_concurrency_limit_reached");
  }
  if (usage.experiment_compute_units + input.requested_compute_units > state.entitlements.monthly_experiment_compute_units) {
    throw new Error("monthly_compute_budget_reached");
  }
  return { state, activeJobs, usage };
}

export async function assertProgramShareAllowed(accountId: string) {
  const state = await accountService.getAccountState(accountId);
  if (!state) throw new Error("account_not_found");
  if (!state.entitlements.can_create_share_links) throw new Error("share_plan_restricted");
  const usage = await accountService.getUsage(accountId);
  if (usage.share_links_created >= state.entitlements.share_links_per_month) {
    throw new Error("share_quota_reached");
  }
  return state;
}
