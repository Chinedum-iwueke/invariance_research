export type ResearchConversation = {
  conversation_id: string;
  program_id: string;
  account_id: string;
  created_by_user_id: string;
  title: string;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type MessagePart =
  | { type: "text"; text: string }
  | { type: "source_citation"; source_id: string; chunk_id: string; label: string; anchor?: Record<string, unknown> }
  | { type: "artifact_citation"; artifact_id: string; label: string; anchor?: Record<string, unknown> }
  | { type: "proposal"; proposal_id: string; proposal_type: ResearchProposalType }
  | { type: "approval_request"; proposal_id: string; label: string }
  | { type: "warning"; code: string; message: string }
  | { type: "tool_result"; tool_call_id: string; tool_name: string; summary: string };

export type ResearchMessage = {
  message_id: string;
  conversation_id: string;
  program_id: string;
  account_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  parts: MessagePart[];
  status: "complete" | "failed" | "retracted";
  reply_to_message_id?: string;
  created_by_user_id?: string;
  created_at: string;
};

export type CopilotMode = "exploratory" | "direct_instruction" | "source_analysis" | "artifact_analysis";
export type FieldProvenance = "stated" | "extracted" | "inferred" | "recommended" | "confirmed" | "unresolved" | "unsupported";

export type CandidateHypothesisPayload = {
  schema_version: "candidate_hypothesis_v1";
  claim: string;
  mechanism: string;
  observable_proxy: string;
  expected_direction: string;
  horizon: string;
  entry_idea: string;
  exit_idea: string;
  required_datasets: string[];
  falsification_test: string;
  failure_modes: string[];
  implementation_readiness: "likely_supported" | "needs_capability_check" | "data_blocked";
  rationale: string;
  source_citations: Array<{ source_id: string; chunk_id: string; quote?: string }>;
};

export type ResearchProposalType = "candidate_hypothesis" | "research_note" | "next_experiment";

export type ResearchProposal = {
  proposal_id: string;
  conversation_id: string;
  program_id: string;
  account_id: string;
  source_message_id: string;
  proposal_type: ResearchProposalType;
  status: "proposed" | "confirmed" | "rejected" | "superseded";
  title: string;
  payload: CandidateHypothesisPayload | Record<string, unknown>;
  provenance: Record<string, { state: FieldProvenance; confidence: number; source_ids?: string[] }>;
  version: number;
  content_hash: string;
  created_at: string;
  confirmed_at?: string;
  confirmed_by_user_id?: string;
};

export type ResearchSource = {
  source_id: string;
  program_id: string;
  account_id: string;
  created_by_user_id: string;
  source_type: "transcript" | "youtube_captions" | "paper" | "text" | "markdown" | "screenshot";
  title: string;
  canonical_url?: string;
  file_name?: string;
  content_type: string;
  storage_key?: string;
  checksum_sha256: string;
  size_bytes: number;
  status: "ready" | "needs_visual_context" | "needs_ocr" | "failed";
  metadata: Record<string, unknown>;
  error_summary?: string;
  created_at: string;
};

export type ResearchSourceChunk = {
  chunk_id: string;
  source_id: string;
  program_id: string;
  account_id: string;
  chunk_index: number;
  content: string;
  anchor: { page?: number; start_char?: number; end_char?: number; start_seconds?: number; end_seconds?: number; section?: string };
  token_estimate: number;
  created_at: string;
};

export type ResearchTurn = {
  turn_id: string;
  conversation_id: string;
  program_id: string;
  account_id: string;
  user_message_id: string;
  assistant_message_id?: string;
  provider: string;
  model?: string;
  prompt_version: string;
  tool_version: string;
  status: "processing" | "completed" | "failed" | "canceled";
  mode?: CopilotMode;
  prompt_tokens?: number;
  completion_tokens?: number;
  duration_ms?: number;
  error_code?: string;
  created_at: string;
  completed_at?: string;
};

export type CopilotConversationDetail = {
  conversation: ResearchConversation;
  messages: ResearchMessage[];
  sources: ResearchSource[];
  source_chunks: ResearchSourceChunk[];
  proposals: ResearchProposal[];
};

export type CopilotAssistantOutput = {
  schema_version: "research_copilot_turn_v1";
  mode: CopilotMode;
  response: string;
  next_question?: string;
  candidates: CandidateHypothesisPayload[];
  research_state: Record<string, { value: string; provenance: FieldProvenance; confidence: number; rationale?: string }>;
  warnings: Array<{ code: string; message: string }>;
};
