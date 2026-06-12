import { z } from "zod";
import { structuredChat, getResearchAssistantConfig } from "@/lib/server/llm/chat-provider";
import type {
  ClarificationQuestion,
  MissingAssumption,
  ResearchBriefIntakeFields,
  ResearchBriefV1,
  ResearchProgram,
} from "@/lib/server/research-programs/models";

export const researchBriefIntakeSchema = z.object({
  market_intuition: z.string().trim().min(10).max(4000),
  asset_universe: z.string().trim().max(500).optional(),
  timeframe: z.string().trim().max(120).optional(),
  holding_period: z.string().trim().max(240).optional(),
  entry_idea: z.string().trim().max(1000).optional(),
  exit_idea: z.string().trim().max(1000).optional(),
  risk_assumption: z.string().trim().max(1000).optional(),
  cost_slippage_assumption: z.string().trim().max(1000).optional(),
  data_source: z.string().trim().max(1000).optional(),
  disproof_condition: z.string().trim().max(1000).optional(),
});

const assistantDraftSchema = z.object({
  questions: z.array(z.object({
    field: z.string(),
    question: z.string(),
    why_it_matters: z.string(),
    required: z.boolean().optional(),
  })).max(10),
  missing_assumptions: z.array(z.object({
    field: z.string(),
    label: z.string(),
    severity: z.enum(["blocking", "important", "optional"]).optional(),
    why_it_matters: z.string(),
  })).max(12),
});

const requiredFieldLabels: Array<{ field: keyof ResearchBriefIntakeFields; label: string; question: string; why: string }> = [
  {
    field: "asset_universe",
    label: "Asset universe",
    question: "Which instruments or asset universe should this thesis be tested on?",
    why: "The same intuition can behave differently across assets; the engine needs an explicit universe.",
  },
  {
    field: "timeframe",
    label: "Timeframe",
    question: "What execution timeframe or bar interval should the first test use?",
    why: "Timeframe determines data requirements, signal timing, costs, and overfitting risk.",
  },
  {
    field: "holding_period",
    label: "Holding period",
    question: "How long should trades normally be held before the thesis is considered stale?",
    why: "Holding period constrains exits, cost sensitivity, and benchmark comparisons.",
  },
  {
    field: "entry_idea",
    label: "Entry idea",
    question: "What observable condition should cause a trade entry?",
    why: "A thesis is not testable until the entry intent can be mapped to observable features.",
  },
  {
    field: "exit_idea",
    label: "Exit idea",
    question: "What should close or invalidate a position once it is open?",
    why: "Exit logic often explains most reported edge and must be explicit before backtesting.",
  },
  {
    field: "risk_assumption",
    label: "Risk assumption",
    question: "What risk model should the first experiment assume?",
    why: "Sizing, stops, and loss limits determine whether an apparently profitable strategy is deployable.",
  },
  {
    field: "cost_slippage_assumption",
    label: "Cost and slippage assumption",
    question: "What fee, spread, slippage, and execution friction should the first test assume?",
    why: "Execution friction is a core falsification path and cannot be silently filled in.",
  },
  {
    field: "data_source",
    label: "Data source",
    question: "Which data source or broker/exchange feed should be trusted for this test?",
    why: "Data provenance controls survivorship, timestamp, and execution realism boundaries.",
  },
  {
    field: "disproof_condition",
    label: "Disproof condition",
    question: "What result would make you reject or pause this thesis?",
    why: "The platform optimizes for falsification; every research brief needs an explicit kill condition.",
  },
];

export function normalizeIntake(input: unknown): ResearchBriefIntakeFields {
  const parsed = researchBriefIntakeSchema.parse(input);
  return Object.fromEntries(
    Object.entries(parsed).filter(([, value]) => typeof value !== "string" || value.trim().length > 0),
  ) as ResearchBriefIntakeFields;
}

function baseMissingAssumptions(intake: ResearchBriefIntakeFields): MissingAssumption[] {
  return requiredFieldLabels
    .filter((item) => !intake[item.field]?.trim())
    .map((item, index) => ({
      assumption_id: `missing_${item.field}_${index + 1}`,
      field: item.field,
      label: item.label,
      severity: ["entry_idea", "exit_idea", "disproof_condition"].includes(item.field) ? "blocking" : "important",
      why_it_matters: item.why,
    }));
}

function baseQuestions(intake: ResearchBriefIntakeFields): ClarificationQuestion[] {
  return requiredFieldLabels
    .filter((item) => !intake[item.field]?.trim())
    .map((item, index) => ({
      question_id: `q_${item.field}_${index + 1}`,
      field: item.field,
      question: item.question,
      why_it_matters: item.why,
      required: ["entry_idea", "exit_idea", "disproof_condition"].includes(item.field),
    }));
}

function safeJson(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  return JSON.parse(fenced ?? trimmed);
}

function buildPrompt(program: ResearchProgram, intake: ResearchBriefIntakeFields) {
  return `You are a strategy research clarification assistant for Invariance Research.

Return JSON only with keys "questions" and "missing_assumptions".
Do not invent unknown strategy details.
Ask concise questions that make the thesis falsifiable before any backtest.
Mark entry logic, exit logic, and disproof criteria as required when missing.

Program title: ${program.title}
Program thesis: ${program.thesis}
Submitted intake JSON:
${JSON.stringify(intake, null, 2)}

Schema:
{
  "questions": [{"field": "entry_idea", "question": "...", "why_it_matters": "...", "required": true}],
  "missing_assumptions": [{"field": "entry_idea", "label": "Entry idea", "severity": "blocking", "why_it_matters": "..."}]
}`;
}

export async function buildClarificationDraft(program: ResearchProgram, intake: ResearchBriefIntakeFields): Promise<{
  questions: ClarificationQuestion[];
  missing_assumptions: MissingAssumption[];
  provider: string;
  model?: string;
  error_summary?: string;
}> {
  const deterministicQuestions = baseQuestions(intake);
  const deterministicMissing = baseMissingAssumptions(intake);
  const config = getResearchAssistantConfig();

  if (!config.enabled) {
    return {
      questions: deterministicQuestions,
      missing_assumptions: deterministicMissing,
      provider: "deterministic",
      model: "rules_v1",
    };
  }

  try {
    const result = await structuredChat({ prompt: buildPrompt(program, intake), jsonSchema: { type: "object" } });
    const parsed = assistantDraftSchema.parse(safeJson(result.content));
    return {
      questions: parsed.questions.map((question, index) => ({
        question_id: `llm_q_${index + 1}`,
        field: question.field as ClarificationQuestion["field"],
        question: question.question,
        why_it_matters: question.why_it_matters,
        required: question.required ?? false,
      })),
      missing_assumptions: parsed.missing_assumptions.map((item, index) => ({
        assumption_id: `llm_missing_${index + 1}`,
        field: item.field,
        label: item.label,
        severity: item.severity ?? "important",
        why_it_matters: item.why_it_matters,
      })),
      provider: result.provider,
      model: result.model,
    };
  } catch (error) {
    return {
      questions: deterministicQuestions,
      missing_assumptions: deterministicMissing,
      provider: "deterministic",
      model: "rules_v1",
      error_summary: error instanceof Error ? error.message : "research_assistant_failed",
    };
  }
}

export function buildResearchBrief(input: {
  program: ResearchProgram;
  intake: ResearchBriefIntakeFields;
  answers: Record<string, string>;
  missingAssumptions: MissingAssumption[];
  createdAt: string;
}): ResearchBriefV1 {
  const answeredText = Object.values(input.answers).join(" ").trim();
  const blockingMissing = input.missingAssumptions.filter((item) => item.severity === "blocking");
  return {
    schema_version: "research_brief_v1",
    program_id: input.program.program_id,
    title: input.program.title,
    thesis: input.program.thesis,
    ...input.intake,
    market_intuition: input.intake.market_intuition,
    missing_assumptions: input.missingAssumptions,
    clarification_answers: input.answers,
    readiness: blockingMissing.length === 0 && answeredText.length > 20 ? "ready_for_hypothesis_draft" : "needs_clarification",
    created_at: input.createdAt,
  };
}
