export type QueueKind = "analysis" | "export" | "experiment" | "execution";

export type OperationControls = {
  global_paused: boolean;
  analysis_queue_paused: boolean;
  export_queue_paused: boolean;
  experiment_queue_paused: boolean;
  execution_queue_paused: boolean;
  assistant_paused: boolean;
};

function parseBool(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

export function getOperationControls(): OperationControls {
  const globalPaused = parseBool(process.env.INVARIANCE_QUEUE_PAUSED) || parseBool(process.env.INVARIANCE_PLATFORM_PAUSED);
  return {
    global_paused: globalPaused,
    analysis_queue_paused: globalPaused || parseBool(process.env.INVARIANCE_ANALYSIS_QUEUE_PAUSED),
    export_queue_paused: globalPaused || parseBool(process.env.INVARIANCE_EXPORT_QUEUE_PAUSED),
    experiment_queue_paused: globalPaused || parseBool(process.env.INVARIANCE_EXPERIMENT_QUEUE_PAUSED),
    execution_queue_paused: globalPaused || parseBool(process.env.INVARIANCE_EXECUTION_QUEUE_PAUSED),
    assistant_paused: globalPaused || parseBool(process.env.INVARIANCE_ASSISTANT_PAUSED),
  };
}

export function pausedOperationNames(controls = getOperationControls()) {
  return Object.entries(controls)
    .filter(([, paused]) => paused)
    .map(([name]) => name);
}

export function assertQueueAccepting(kind: QueueKind) {
  const controls = getOperationControls();
  if (kind === "analysis" && controls.analysis_queue_paused) throw new Error("analysis_queue_paused");
  if (kind === "export" && controls.export_queue_paused) throw new Error("export_queue_paused");
  if (kind === "experiment" && controls.experiment_queue_paused) throw new Error("experiment_queue_paused");
  if (kind === "execution" && controls.execution_queue_paused) throw new Error("execution_queue_paused");
}

export function assertAssistantAccepting() {
  if (getOperationControls().assistant_paused) throw new Error("assistant_paused");
}

export function isOperationalPauseError(code: string) {
  return code === "analysis_queue_paused"
    || code === "export_queue_paused"
    || code === "experiment_queue_paused"
    || code === "execution_queue_paused"
    || code === "assistant_paused";
}
