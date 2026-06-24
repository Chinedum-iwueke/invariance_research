import { createHash, randomBytes, randomUUID } from "node:crypto";
import { accountService } from "@/lib/server/accounts/service";
import {
  hashLifecycleEvent,
  type ResearchLifecycleEvent,
} from "@/lib/contracts/research-lifecycle";
import { getCoreRepositories } from "@/lib/server/persistence/repositories";
import { getResearchProgramDetail } from "@/lib/server/research-programs/service";
import { researchProgramRepository } from "@/lib/server/research-programs/repository";
import { ingestExperimentEventIntoMemory } from "@/lib/server/research-memory/service";
import { c2Repository } from "@/lib/server/research-c2/repository";
import {
  buildQualification,
  canonicalHash,
  compareSignals,
  compilePine,
  normalizePortableIr,
  parseRestrictedPine,
  pineCompatibility,
} from "@/lib/server/research-c2/contracts";
import type {
  CatalogEntry,
  PineExportRecord,
  QualificationRecord,
} from "@/lib/server/research-c2/models";
import { researchSpecV2Repository } from "@/lib/server/research-specs-v2/repository";
import { getObjectStorage } from "@/lib/server/storage/object-storage";

async function program(programId: string, accountId: string) {
  const p = await researchProgramRepository.findSummaryById(programId);
  if (!p || p.account_id !== accountId) throw new Error("program_not_found");
  return p;
}
export async function getC2Detail(programId: string, accountId: string) {
  await program(programId, accountId);
  return c2Repository.detail(programId, accountId);
}
function catalogEntry(
  input: Omit<
    CatalogEntry,
    | "schema_version"
    | "catalog_hash"
    | "catalog_id"
    | "created_at"
    | "updated_at"
  >,
): CatalogEntry {
  const now = new Date().toISOString();
  const catalogId = `cat_${canonicalHash({ program_id: input.program_id, artifact_type: input.artifact_type, object_id: input.object_id, content_hash: input.content_hash }).slice(0, 24)}`;
  const contract = {
    ...input,
    schema_version: "program_artifact_catalog_entry_v1" as const,
    catalog_id: catalogId,
  };
  const normalized = {
    ...contract,
    created_at: now,
    updated_at: now,
  };
  return { ...normalized, catalog_hash: canonicalHash(contract) };
}

async function appendC2Lifecycle(input: {
  programId: string;
  accountId: string;
  userId: string;
  eventType:
    | "promotion"
    | "pine_export"
    | "pine_import"
    | "pine_parity"
    | "tradingview_observation";
  strategySpecHash: string;
  codeHash: string;
  dataSnapshotId: string;
  payload: Record<string, unknown>;
  stage?: "backtest" | "demo";
  actorType?: "user" | "assistant" | "worker" | "engine" | "exchange";
}) {
  const event: Omit<ResearchLifecycleEvent, "event_hash"> = {
    schema_version: "research_lifecycle_event_v1",
    event_id: randomUUID(),
    event_type: input.eventType,
    occurred_at: new Date().toISOString(),
    identity: {
      program_id: input.programId,
      account_id: input.accountId,
      stage: input.stage ?? "backtest",
      strategy_spec_hash: input.strategySpecHash,
      code_hash: input.codeHash,
      data_snapshot_id: input.dataSnapshotId,
      ...(input.stage === "demo"
        ? {
            deployment_id: `qualification:${String(input.payload.qualification_id ?? "pending")}`,
          }
        : {}),
    },
    payload: input.payload,
    actor: { type: input.actorType ?? "user", id: input.userId },
  };
  await researchSpecV2Repository.appendLifecycle({
    ...event,
    event_hash: hashLifecycleEvent(event),
  });
}

export async function syncProgramArtifactCatalog(
  programId: string,
  accountId: string,
) {
  await program(programId, accountId);
  const [detail, specs, existingC2] = await Promise.all([
    getResearchProgramDetail(programId, accountId),
    researchSpecV2Repository.list(programId, accountId),
    c2Repository.detail(programId, accountId),
  ]);
  if (!detail) throw new Error("program_not_found");
  const entries: CatalogEntry[] = [];
  for (const bundle of specs.bundles) {
    entries.push(
      catalogEntry({
        account_id: accountId,
        program_id: programId,
        artifact_type: "spec",
        object_id: bundle.spec_bundle_id,
        sensitivity: "program_private",
        content_hash: bundle.bundle_hash,
        lineage: {
          spec_bundle_id: bundle.spec_bundle_id,
          card_record_id: bundle.card_record_id,
        },
        summary: `Strategy specification bundle ${bundle.version} is ${bundle.compile_status}.`,
        searchable_text: JSON.stringify({
          status: bundle.compile_status,
          blockers: bundle.bundle.compile_readiness.blockers,
        }),
        anchors: [{ json_pointer: "/compile_readiness" }],
        schema: { type: "object" },
        query_payload: {
          spec: bundle.bundle.strategy_spec,
          readiness: bundle.bundle.compile_readiness,
        },
        units: {},
        status: "ready",
      }),
    );
  }
  for (const item of detail.experiment_plan_items) {
    entries.push(
      catalogEntry({
        account_id: accountId,
        program_id: programId,
        artifact_type: "run_config",
        object_id: item.experiment_plan_item_id,
        sensitivity: "program_private",
        content_hash: canonicalHash(item.config_patch),
        lineage: {
          plan_id: item.experiment_plan_id,
          plan_item_id: item.experiment_plan_item_id,
        },
        summary: `Run configuration for ${item.title}.`,
        searchable_text: JSON.stringify({
          title: item.title,
          config: item.config_patch,
          falsification_question: item.falsification_question,
        }),
        anchors: [{ json_pointer: "/config_patch" }],
        schema: { type: "object" },
        query_payload: {
          config: item.config_patch,
          required_datasets: item.required_datasets,
          runtime_budget: item.runtime_budget,
        },
        units: {},
        status: "ready",
      }),
    );
  }
  for (const attached of detail.artifacts) {
    const source = attached.artifact_id
      ? await Promise.resolve(
          getCoreRepositories().artifacts.findById(attached.artifact_id),
        )
      : undefined;
    if (!source || source.account_id !== accountId) {
      entries.push(
        catalogEntry({
          account_id: accountId,
          program_id: programId,
          artifact_type: "dataset",
          object_id: attached.program_artifact_id,
          sensitivity: "program_private",
          content_hash: canonicalHash(attached),
          lineage: {
            analysis_id: attached.analysis_id,
            artifact_role: attached.artifact_role,
          },
          summary:
            "Attached program artifact is not available to the typed reader.",
          searchable_text: JSON.stringify(attached),
          anchors: [{ program_artifact_id: attached.program_artifact_id }],
          schema: {},
          query_payload: {},
          units: {},
          status: "unsupported",
        }),
      );
      continue;
    }
    const parsed = source.parsed_artifact;
    entries.push(
      catalogEntry({
        account_id: accountId,
        program_id: programId,
        artifact_type: "dataset",
        object_id: source.artifact_id,
        sensitivity: "program_private",
        content_hash: source.checksum_sha256,
        lineage: {
          analysis_id: attached.analysis_id,
          artifact_role: attached.artifact_role,
        },
        summary: `${source.file_name} · ${source.artifact_kind} · ${source.richness}.`,
        searchable_text: JSON.stringify({
          file_name: source.file_name,
          kind: source.artifact_kind,
          richness: source.richness,
          source_files: parsed.source_files,
        }),
        anchors: [{ storage_key: source.storage_key }],
        schema: { artifact_type: parsed.artifact_type },
        query_payload: {
          metadata: parsed.strategy_metadata,
          manifest: parsed.bundle_manifest,
          eligibility: source.eligibility_summary,
        },
        units: {},
        storage_key: source.storage_key,
        status: "ready",
      }),
    );
    if (parsed.trades.length)
      entries.push(
        catalogEntry({
          account_id: accountId,
          program_id: programId,
          artifact_type: "trades",
          object_id: `${source.artifact_id}:trades`,
          sensitivity: "program_private",
          content_hash: canonicalHash(parsed.trades),
          lineage: {
            analysis_id: attached.analysis_id,
            artifact_id: source.artifact_id,
          },
          summary: `${parsed.trades.length} normalized trades from ${source.file_name}.`,
          searchable_text: `${source.file_name} normalized trades symbols ${[...new Set(parsed.trades.map((x) => String(x.symbol ?? "")))].join(" ")}`,
          anchors: [
            {
              storage_key: source.storage_key,
              row_start: 1,
              row_end: parsed.trades.length,
            },
          ],
          schema: { columns: Object.keys(parsed.trades[0] ?? {}) },
          query_payload: {
            trades: parsed.trades,
            sample: parsed.trades.length,
            tier: "normalized_upload",
          },
          units: { pnl: "account_currency", pnl_pct: "percent" },
          storage_key: source.storage_key,
          status: "ready",
        }),
      );
  }
  for (const event of detail.experiment_job_events) {
    const payload = event.payload;
    const type =
      event.event_type === "failed"
        ? "incident"
        : event.event_type === "completed"
          ? "manifest"
          : "log";
    entries.push(
      catalogEntry({
        account_id: accountId,
        program_id: programId,
        artifact_type: type,
        object_id: event.experiment_job_event_id,
        sensitivity: "program_private",
        content_hash: canonicalHash(payload),
        lineage: {
          run_id: event.experiment_job_id,
          plan_id: event.experiment_plan_id,
        },
        summary: event.message,
        searchable_text: `${event.message} ${JSON.stringify(payload)}`,
        anchors: [
          {
            event_id: event.experiment_job_event_id,
            timestamp: event.created_at,
          },
        ],
        schema: { type: "object" },
        query_payload: payload,
        units: {},
        status: "ready",
      }),
    );
    if (payload.card_summary)
      entries.push(
        catalogEntry({
          account_id: accountId,
          program_id: programId,
          artifact_type: "verdict_card",
          object_id: `verdict-${event.experiment_job_event_id}`,
          sensitivity: "program_private",
          content_hash: canonicalHash(payload.card_summary),
          lineage: { run_id: event.experiment_job_id },
          summary: "Experiment verdict card summary.",
          searchable_text: JSON.stringify(payload.card_summary),
          anchors: [
            {
              event_id: event.experiment_job_event_id,
              json_pointer: "/card_summary",
            },
          ],
          schema: { type: "object" },
          query_payload: {
            verdict: payload.card_summary,
            failures:
              event.event_type === "failed"
                ? [{ timestamp: event.created_at, reason: event.message }]
                : [],
          },
          units: {},
          status: "ready",
        }),
      );
  }
  for (const report of detail.reports)
    entries.push(
      catalogEntry({
        account_id: accountId,
        program_id: programId,
        artifact_type: "report",
        object_id: report.program_report_snapshot_id,
        sensitivity: "program_private",
        content_hash: canonicalHash(report.payload),
        lineage: { report_id: report.program_report_snapshot_id },
        summary: report.title,
        searchable_text: JSON.stringify(report.payload),
        anchors: [{ json_pointer: "/" }],
        schema: { type: "object" },
        query_payload: report.payload as unknown as Record<string, unknown>,
        units: {},
        status: "ready",
      }),
    );
  for (const item of detail.memory.items)
    entries.push(
      catalogEntry({
        account_id: accountId,
        program_id: programId,
        artifact_type: "memory",
        object_id: item.memory_item_id,
        sensitivity: "program_private",
        content_hash: canonicalHash(item),
        lineage: { run_id: item.experiment_job_id },
        summary: item.summary,
        searchable_text: `${item.title} ${item.summary}`,
        anchors: [{ memory_item_id: item.memory_item_id }],
        schema: { type: "object" },
        query_payload: item as unknown as Record<string, unknown>,
        units: {},
        status: "ready",
      }),
    );
  for (const analysisList of detail.analyses) {
    const analysis = await getCoreRepositories().analyses.findById(
      analysisList.analysis_id,
    );
    if (!analysis || analysis.account_id !== accountId) continue;
    const result = analysis.result as unknown as
      | Record<string, unknown>
      | undefined;
    const resultSummary =
      result?.summary && typeof result.summary === "object"
        ? (result.summary as Record<string, unknown>)
        : undefined;
    entries.push(
      catalogEntry({
        account_id: accountId,
        program_id: programId,
        artifact_type: "metrics",
        object_id: analysis.analysis_id,
        sensitivity: "program_private",
        content_hash: canonicalHash(result ?? {}),
        lineage: {
          analysis_id: analysis.analysis_id,
          run_id: analysis.analysis_id,
        },
        summary: `Imported analysis ${analysis.strategy_name ?? analysis.analysis_id}.`,
        searchable_text: JSON.stringify(result ?? {}).slice(0, 100_000),
        anchors: [{ analysis_id: analysis.analysis_id, json_pointer: "/" }],
        schema: { type: "object" },
        query_payload: {
          metrics: result ?? {},
          sample: resultSummary?.trade_count,
          tier: "upload_audit",
        },
        units: {},
        status: result ? "ready" : "unsupported",
      }),
    );
  }
  const existingKeys = new Set(
    existingC2.catalog.map(
      (entry) =>
        `${entry.artifact_type}|${entry.object_id}|${entry.content_hash}`,
    ),
  );
  for (const entry of entries)
    if (
      !existingKeys.has(
        `${entry.artifact_type}|${entry.object_id}|${entry.content_hash}`,
      )
    )
      await c2Repository.upsertCatalog(entry);
  return c2Repository.detail(programId, accountId).then((x) => x.catalog);
}

type QueryType =
  | "run_metrics"
  | "trade_cohorts"
  | "verdict_cards"
  | "first_failure"
  | "assumption_lookup"
  | "run_comparison"
  | "artifact_manifest"
  | "memory_search";
export function inferArtifactQuery(question: string): QueryType {
  const q = question.toLowerCase();
  if (/compare|versus| vs /.test(q)) return "run_comparison";
  if (/first fail|first breach|what failed/.test(q)) return "first_failure";
  if (/assumption|fee|slippage|config/.test(q)) return "assumption_lookup";
  if (/trade|cohort|winner|loser|outlier/.test(q)) return "trade_cohorts";
  if (/verdict|fragil|promis|surviv/.test(q)) return "verdict_cards";
  if (/memory|similar|previous/.test(q)) return "memory_search";
  if (/manifest|artifact|available/.test(q)) return "artifact_manifest";
  return "run_metrics";
}
export function queryCatalog(
  entries: CatalogEntry[],
  query: { query_type: QueryType; text?: string; object_ids?: string[] },
  accountId: string,
  programId: string,
  limit = 50,
) {
  const map: Record<QueryType, Set<string>> = {
    run_metrics: new Set(["metrics"]),
    trade_cohorts: new Set(["trades"]),
    verdict_cards: new Set(["verdict_card"]),
    first_failure: new Set(["verdict_card", "log", "incident"]),
    assumption_lookup: new Set(["run_config", "spec", "manifest"]),
    run_comparison: new Set(["metrics", "verdict_card"]),
    artifact_manifest: new Set([
      "manifest",
      "run_config",
      "dataset",
      "trades",
      "metrics",
      "verdict_card",
      "log",
      "report",
      "incident",
      "spec",
      "memory",
    ]),
    memory_search: new Set(["memory"]),
  };
  let scoped = entries.filter(
    (e) =>
      e.account_id === accountId &&
      e.program_id === programId &&
      e.sensitivity !== "secret" &&
      map[query.query_type].has(e.artifact_type),
  );
  if (query.object_ids?.length)
    scoped = scoped.filter((e) => query.object_ids!.includes(e.object_id));
  if (query.query_type === "memory_search" && query.text) {
    const terms = [
      ...new Set(
        query.text
          .toLowerCase()
          .split(/\W+/)
          .filter((x) => x.length > 2),
      ),
    ];
    scoped = scoped
      .map((entry) => ({
        entry,
        score: terms.reduce(
          (sum, term) =>
            sum + (entry.searchable_text.toLowerCase().includes(term) ? 1 : 0),
          0,
        ),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.entry);
  }
  const rows = scoped
    .slice(0, Math.min(limit, 500))
    .flatMap<Record<string, unknown>>((e) => {
      const p = e.query_payload;
      if (query.query_type === "run_metrics") {
        const metrics =
          p.metrics && typeof p.metrics === "object"
            ? (p.metrics as Record<string, unknown>)
            : p;
        return Object.entries(metrics)
          .slice(0, limit)
          .map(([metric, value]) => ({
            metric,
            value,
            unit: e.units[metric] ?? "unspecified",
            sample: p.sample ?? null,
            tier: p.tier ?? "unspecified",
            run_id: e.lineage.run_id ?? e.lineage.analysis_id ?? null,
            catalog_id: e.catalog_id,
            anchor: e.anchors[0] ?? {},
          }));
      }
      if (query.query_type === "trade_cohorts") {
        const trades = Array.isArray(p.trades) ? p.trades : [];
        const text = query.text?.toLowerCase() ?? "",
          cohort = text.includes("winner")
            ? "winners"
            : text.includes("loser")
              ? "losers"
              : "all",
          filtered =
            cohort === "winners"
              ? trades.filter(
                  (trade) =>
                    Number((trade as Record<string, unknown>).pnl ?? 0) > 0,
                )
              : cohort === "losers"
                ? trades.filter(
                    (trade) =>
                      Number((trade as Record<string, unknown>).pnl ?? 0) < 0,
                  )
                : trades;
        return filtered.slice(0, limit).map((trade, index) => ({
          trade,
          index,
          cohort,
          unit: "trade_record",
          sample: filtered.length,
          tier: p.tier ?? "normalized_upload",
          run_id: e.lineage.run_id ?? e.lineage.analysis_id ?? null,
          catalog_id: e.catalog_id,
          anchor: { ...(e.anchors[0] ?? {}), row: index + 1 },
        }));
      }
      if (query.query_type === "first_failure") {
        const f = Array.isArray(p.failures) ? p.failures : [];
        return f.slice(0, 1).map((failure) => ({
          failure,
          unit: "event",
          sample: f.length,
          tier: p.tier ?? "experiment_event",
          run_id: e.lineage.run_id ?? null,
          catalog_id: e.catalog_id,
          anchor: e.anchors[0] ?? {},
        }));
      }
      return [
        {
          object_id: e.object_id,
          artifact_type: e.artifact_type,
          status: e.status,
          summary: e.summary,
          payload: p,
          unit: "artifact",
          sample: p.sample ?? null,
          tier: p.tier ?? "catalog",
          run_id: e.lineage.run_id ?? e.lineage.analysis_id ?? null,
          catalog_id: e.catalog_id,
          anchor: e.anchors[0] ?? {},
        },
      ];
    });
  const orderedRows =
    query.query_type === "first_failure"
      ? [...rows]
          .sort((a, b) =>
            String(
              (a.failure as Record<string, unknown> | undefined)?.timestamp ??
                "",
            ).localeCompare(
              String(
                (b.failure as Record<string, unknown> | undefined)?.timestamp ??
                  "",
              ),
            ),
          )
          .slice(0, 1)
      : rows;
  const selectedRows = orderedRows.slice(0, limit);
  const usedIds = new Set(
    selectedRows
      .map((row) => (row as { catalog_id?: string }).catalog_id)
      .filter(Boolean),
  );
  const citations = scoped
    .filter(
      (entry) =>
        usedIds.has(entry.catalog_id) ||
        query.query_type === "artifact_manifest",
    )
    .slice(0, limit)
    .map((e) => ({
      catalog_id: e.catalog_id,
      object_id: e.object_id,
      content_hash: e.content_hash,
      anchor: e.anchors[0] ?? {},
    }));
  const result = {
    schema_version: "artifact_query_result_v1",
    query_type: query.query_type,
    rows: selectedRows,
    citations,
    result_count: selectedRows.length,
    truncated: scoped.length > limit || orderedRows.length > limit,
  };
  return { ...result, result_hash: canonicalHash(result) };
}
export function interpretArtifactResult(
  result: ReturnType<typeof queryCatalog>,
  question: string,
) {
  const facts = result.rows.slice(0, 12).map((row, index) => ({
    statement:
      "metric" in row
        ? `${String(row.metric)}: ${String(row.value)} ${String(row.unit)} · sample ${String(row.sample)} · ${String(row.tier)} · run ${String(row.run_id)}`
        : "failure" in row
          ? `First recorded failure: ${JSON.stringify(row.failure).slice(0, 600)}`
          : "trade" in row
            ? `Trade ${Number(row.index) + 1}: ${JSON.stringify(row.trade).slice(0, 600)}`
            : `${String(row.artifact_type ?? result.query_type)} ${index + 1}: ${String(row.summary ?? row.object_id ?? "catalog evidence")}`,
    citations: result.citations
      .filter((c) => c.catalog_id === String(row.catalog_id))
      .slice(0, 1),
  }));
  const answer = {
    schema_version: "cited_research_answer_v1",
    question,
    facts,
    inferences: [],
    recommendations: facts.length
      ? [
          {
            statement:
              "Use this evidence to define the next falsification experiment; this answer cannot promote or deploy a strategy.",
            requires_confirmation: true,
          },
        ]
      : [],
    unknowns: facts.length
      ? []
      : [
          {
            statement: "No supported catalog evidence answers this question.",
            reason: "insufficient_supported_artifacts",
          },
        ],
    citations: result.citations,
    canonical_query_hash: result.result_hash,
  };
  return { ...answer, answer_hash: canonicalHash(answer) };
}
export async function artifactContextForTurn(input: {
  programId: string;
  accountId: string;
  turnId: string;
  question: string;
  objectIds?: string[];
}) {
  await syncProgramArtifactCatalog(input.programId, input.accountId);
  const detail = await c2Repository.detail(input.programId, input.accountId);
  const mentionedObjectIds = [
    ...input.question.matchAll(/(?:@|\[)artifact:([A-Za-z0-9:_-]+)\]?/g),
  ].map((match) => match[1]);
  const explicitObjectIds = [
    ...new Set([...(input.objectIds ?? []), ...mentionedObjectIds]),
  ].slice(0, 20);
  let query: { query_type: QueryType; text: string; object_ids?: string[] } = {
    query_type: inferArtifactQuery(input.question),
    text: input.question,
    object_ids: explicitObjectIds.length ? explicitObjectIds : undefined,
  };
  let result = queryCatalog(
    detail.catalog,
    query,
    input.accountId,
    input.programId,
  );
  if (
    !result.rows.length &&
    explicitObjectIds.length &&
    query.query_type !== "artifact_manifest"
  ) {
    query = { ...query, query_type: "artifact_manifest" };
    result = queryCatalog(
      detail.catalog,
      query,
      input.accountId,
      input.programId,
    );
  }
  const maxChars = Math.max(
    4_000,
    Number(process.env.ARTIFACT_CONTEXT_MAX_CHARS ?? 24_000),
  );
  while (JSON.stringify(result).length > maxChars && result.rows.length > 1) {
    result = queryCatalog(
      detail.catalog,
      query,
      input.accountId,
      input.programId,
      Math.max(1, Math.floor(result.rows.length / 2)),
    );
    result = {
      ...result,
      truncated: true,
      result_hash: canonicalHash({
        ...result,
        truncated: true,
        result_hash: undefined,
      }),
    };
  }
  const tokenEstimate = Math.ceil(JSON.stringify(result).length / 4);
  await c2Repository.saveContext({
    id: randomUUID(),
    turnId: input.turnId,
    accountId: input.accountId,
    programId: input.programId,
    query,
    result,
    catalogIds: result.citations.map((c) => c.catalog_id),
    tokenEstimate,
    truncated: result.truncated,
    createdAt: new Date().toISOString(),
  });
  return {
    query,
    result,
    answer: interpretArtifactResult(result, input.question),
  };
}

function findEvidenceValue(value: unknown, key: string, depth = 0): unknown {
  if (depth > 5 || !value || typeof value !== "object") return undefined;
  if (!Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, key))
    return (value as Record<string, unknown>)[key];
  for (const child of Array.isArray(value)
    ? value
    : Object.values(value as Record<string, unknown>)) {
    const found = findEvidenceValue(child, key, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

async function deriveExperimentQualificationEvidence(
  programId: string,
  accountId: string,
  experimentJobId: string,
  provided: Record<string, unknown>,
) {
  const detail = await getResearchProgramDetail(programId, accountId);
  if (!detail) throw new Error("program_not_found");
  const job = detail.experiment_jobs.find(
    (item) => item.experiment_job_id === experimentJobId,
  );
  if (!job) throw new Error("experiment_job_not_found");
  if (job.status !== "completed")
    throw new Error("completed_experiment_required");
  const events = detail.experiment_job_events.filter(
      (event) => event.experiment_job_id === experimentJobId,
    ),
    payloads = events.map((event) => event.payload),
    item = detail.experiment_plan_items.find(
      (candidate) =>
        candidate.experiment_plan_item_id === job.experiment_plan_item_id,
    ),
    pick = (key: string) => findEvidenceValue(payloads, key),
    truth = pick("truth_certification");
  const derived: Record<string, unknown> = {
    experiment_run_id: experimentJobId,
    config_hash: String(
      pick("config_hash") ?? canonicalHash(item?.config_patch ?? {}),
    ),
    code_hash: pick("code_hash"),
    data_snapshot_id: pick("data_snapshot_id") ?? pick("dataset_snapshot_id"),
    truth_certification:
      truth && typeof truth === "object"
        ? (truth as Record<string, unknown>).status
        : truth,
    blocking_contract_errors: pick("blocking_contract_errors") ?? false,
    fees_bps: pick("fees_bps"),
    slippage_bps: pick("slippage_bps"),
    spread_bps: pick("spread_bps"),
    timing_model: pick("timing_model"),
    leverage: pick("leverage"),
    liquidation_model: pick("liquidation_model"),
    trade_count: pick("trade_count"),
    coverage_days: pick("coverage_days"),
    holdout_status: pick("holdout_status"),
    cost_survival: pick("cost_survival"),
    risk_of_ruin: pick("risk_of_ruin"),
    symbols: pick("symbols"),
    exchange_product_type: pick("exchange_product_type"),
    unresolved_critical_verdicts: pick("unresolved_critical_verdicts") ?? 0,
    limitations: pick("limitations") ?? [],
    evidence_origin: "completed_experiment_events",
    evidence_event_ids: events.map((event) => event.experiment_job_event_id),
  };
  return {
    ...provided,
    ...Object.fromEntries(
      Object.entries(derived).filter(([, value]) => value !== undefined),
    ),
  };
}

export async function createQualification(input: {
  programId: string;
  accountId: string;
  userId: string;
  specBundleId: string;
  experimentJobId?: string;
  evidence: Record<string, unknown>;
  approval: Record<string, unknown>;
  confirmExactHashes?: boolean;
}) {
  await program(input.programId, input.accountId);
  const specs = await researchSpecV2Repository.list(
    input.programId,
    input.accountId,
  );
  const bundle = specs.bundles.find(
    (x) => x.spec_bundle_id === input.specBundleId && x.status === "approved",
  );
  if (!bundle) throw new Error("approved_spec_bundle_required");
  const ir = normalizePortableIr(
    bundle.bundle.strategy_spec as Record<string, unknown>,
  );
  const id = randomUUID();
  const evidence = input.experimentJobId
    ? await deriveExperimentQualificationEvidence(
        input.programId,
        input.accountId,
        input.experimentJobId,
        input.evidence,
      )
    : input.evidence;
  const approval = input.confirmExactHashes
    ? {
        ...input.approval,
        approved_by: input.userId,
        approved_at: new Date().toISOString(),
      }
    : input.approval;
  const snapshot = buildQualification({
    qualificationId: id,
    programId: input.programId,
    ir,
    evidence: {
      ...evidence,
      qualification_id: id,
      program_id: input.programId,
    },
    approval,
  });
  const now = new Date().toISOString();
  const row: QualificationRecord = {
    qualification_id: id,
    program_id: input.programId,
    account_id: input.accountId,
    spec_bundle_id: bundle.spec_bundle_id,
    experiment_job_id: input.experimentJobId,
    status: snapshot.status as "blocked" | "qualified",
    strategy_spec_hash: snapshot.strategy_spec_hash,
    risk_policy_hash: snapshot.risk_policy_hash,
    config_hash: snapshot.config_hash,
    snapshot_hash: snapshot.snapshot_hash,
    snapshot,
    created_by_user_id: input.userId,
    created_at: now,
    approved_at: snapshot.status === "qualified" ? now : undefined,
    approved_by_user_id:
      snapshot.status === "qualified" ? input.userId : undefined,
  };
  await c2Repository.saveQualification(row);
  if (snapshot.status === "qualified")
    await appendC2Lifecycle({
      programId: input.programId,
      accountId: input.accountId,
      userId: input.userId,
      eventType: "promotion",
      strategySpecHash: snapshot.strategy_spec_hash,
      codeHash: String(evidence.code_hash),
      dataSnapshotId: String(evidence.data_snapshot_id),
      stage: "demo",
      payload: {
        qualification_id: id,
        from_stage: "backtest",
        to_stage: "demo",
        decision: "qualified",
        evidence_hash: snapshot.snapshot_hash,
        config_hash: snapshot.config_hash,
        risk_policy_hash: snapshot.risk_policy_hash,
      },
    });
  return row;
}
export async function assertPineAllowed(accountId: string) {
  const state = await accountService.getAccountState(accountId);
  if (!state) throw new Error("account_not_found");
  if (state.account.plan_id === "free")
    throw new Error("pine_export_plan_restricted");
  return state;
}
export async function previewPineCompatibility(input: {
  programId: string;
  accountId: string;
  specBundleId: string;
}) {
  await program(input.programId, input.accountId);
  const specs = await researchSpecV2Repository.list(
      input.programId,
      input.accountId,
    ),
    spec = specs.bundles.find(
      (item) =>
        item.spec_bundle_id === input.specBundleId &&
        item.status === "approved",
    );
  if (!spec) throw new Error("approved_spec_bundle_required");
  return pineCompatibility(
    normalizePortableIr(spec.bundle.strategy_spec as Record<string, unknown>),
  );
}
export async function generatePineExport(input: {
  programId: string;
  accountId: string;
  userId: string;
  specBundleId: string;
}) {
  await program(input.programId, input.accountId);
  await assertPineAllowed(input.accountId);
  const detail = await c2Repository.detail(input.programId, input.accountId);
  const periodStart = Date.now() - 30 * 86_400_000;
  if (
    detail.pine_exports.filter(
      (item) => new Date(item.created_at).getTime() >= periodStart,
    ).length >= 25
  )
    throw new Error("pine_export_program_quota_reached");
  const specs = await researchSpecV2Repository.list(
    input.programId,
    input.accountId,
  );
  const spec = specs.bundles.find(
    (x) => x.spec_bundle_id === input.specBundleId && x.status === "approved",
  );
  if (!spec) throw new Error("approved_spec_bundle_required");
  const id = randomUUID(),
    jobId = randomUUID(),
    now = new Date().toISOString();
  await c2Repository.savePineExportJob({
    pine_export_job_id: jobId,
    pine_export_id: id,
    account_id: input.accountId,
    program_id: input.programId,
    spec_bundle_id: spec.spec_bundle_id,
    status: "running",
    progress_pct: 10,
    created_by_user_id: input.userId,
    created_at: now,
    started_at: now,
  });
  try {
    const ir = normalizePortableIr(
      spec.bundle.strategy_spec as Record<string, unknown>,
    );
    const bundle = compilePine(ir, {
      exportId: id,
      programId: input.programId,
      generatedAt: now,
      approved: true,
    });
    const prefix = `pine-exports/${input.accountId}/${input.programId}/${id}`;
    const files: Array<[string, string, string]> = [
      ["strategy_visualization.pine", bundle.source, "text/plain"],
      [
        "pine_export_manifest.json",
        JSON.stringify(bundle.manifest, null, 2),
        "application/json",
      ],
      [
        "pine_compatibility_report.json",
        JSON.stringify(bundle.compatibility, null, 2),
        "application/json",
      ],
      [
        "pine_parity_report.json",
        JSON.stringify(bundle.parity, null, 2),
        "application/json",
      ],
      [
        "strategy_spec.snapshot.json",
        JSON.stringify(bundle.strategy_spec_snapshot, null, 2),
        "application/json",
      ],
      ["README.md", bundle.readme, "text/markdown"],
    ];
    if (bundle.simulation_source)
      files.push([
        "strategy_simulation.pine",
        bundle.simulation_source,
        "text/plain",
      ]);
    const storage = getObjectStorage();
    for (const [name, content, type] of files)
      await storage.putObject({
        bucket: "exports",
        file_name: name,
        content_type: type,
        bytes: new TextEncoder().encode(content),
        storage_key: `${prefix}/${name}`,
      });
    await c2Repository.supersedePineExports(
      input.programId,
      input.accountId,
      now,
    );
    const row: PineExportRecord = {
      pine_export_id: id,
      account_id: input.accountId,
      program_id: input.programId,
      spec_bundle_id: spec.spec_bundle_id,
      status: "ready",
      compatibility_status: bundle.compatibility.status,
      parity_status: "provisional",
      bundle_hash: bundle.bundle_hash,
      storage_prefix: prefix,
      manifest: bundle.manifest,
      created_by_user_id: input.userId,
      created_at: now,
    };
    await c2Repository.savePineExport(row);
    await c2Repository.updatePineExportJob(jobId, input.accountId, {
      status: "ready",
      progress_pct: 100,
      finished_at: new Date().toISOString(),
    });
    await appendC2Lifecycle({
      programId: input.programId,
      accountId: input.accountId,
      userId: input.userId,
      eventType: "pine_export",
      strategySpecHash: ir.strategy_spec_hash,
      codeHash: "pine_bridge_v1",
      dataSnapshotId: "visualization_not_bound_to_dataset",
      payload: {
        script_hash: String(
          bundle.manifest.files["strategy_visualization.pine"],
        ),
        strategy_spec_hash: ir.strategy_spec_hash,
        pine_version: "v6",
        compatibility:
          bundle.compatibility.simulation_status === "simulation_compatible"
            ? "signal_compatible"
            : "visualization_only",
        parity_status: "not_run",
        observation_only: true,
        unsupported_semantics: bundle.compatibility.unsupported,
        export_id: id,
      },
    });
    return row;
  } catch (error) {
    await c2Repository.updatePineExportJob(jobId, input.accountId, {
      status: "failed",
      progress_pct: 100,
      error_code:
        error instanceof Error
          ? error.message.split(":")[0]
          : "pine_export_failed",
      finished_at: new Date().toISOString(),
    });
    throw error;
  }
}
export async function importPine(input: {
  programId: string;
  accountId: string;
  userId: string;
  source: string;
}) {
  await program(input.programId, input.accountId);
  const report = parseRestrictedPine(input.source),
    id = randomUUID(),
    now = new Date().toISOString(),
    key = `pine-imports/${input.accountId}/${input.programId}/${id}/source.pine`;
  const draftObjects =
    report.draft_spec_status === "draft"
      ? {
          research_brief: {
            source: "pine_import",
            status: "draft",
            provenance: { source_hash: report.source_checksum },
            claim:
              "Requires user reconstruction from the parsed signal projection.",
          },
          hypothesis_spec: {
            schema_version: "hypothesis_spec_v2",
            status: "draft",
            provenance: { source_hash: report.source_checksum },
            user_confirmation_required: true,
          },
          strategy_spec: {
            schema_version: "strategy_spec_v2",
            status: "draft",
            provenance: { source_hash: report.source_checksum },
            user_approval_required: true,
          },
        }
      : undefined;
  const storedReport = {
    ...report,
    draft_objects: draftObjects,
    execution_prohibited: true,
  };
  await getObjectStorage().putObject({
    bucket: "research-sources",
    file_name: "source.pine",
    content_type: "text/plain",
    bytes: new TextEncoder().encode(input.source),
    storage_key: key,
  });
  await c2Repository.saveImport({
    id,
    accountId: input.accountId,
    programId: input.programId,
    sourceHash: report.source_checksum,
    storageKey: key,
    report: storedReport,
    status: report.draft_spec_status,
    userId: input.userId,
    createdAt: now,
  });
  await appendC2Lifecycle({
    programId: input.programId,
    accountId: input.accountId,
    userId: input.userId,
    eventType: "pine_import",
    strategySpecHash: "draft_unconfirmed",
    codeHash: report.source_checksum,
    dataSnapshotId: "pine_source_only",
    payload: {
      script_hash: report.source_checksum,
      pine_version: report.detected_pine_version,
      compatibility:
        report.draft_spec_status === "draft"
          ? "visualization_only"
          : "unsupported",
      observation_only: true,
      unsupported_semantics: report.rejected_constructs,
      import_id: id,
    },
  });
  return { id, report: storedReport, draft_objects: draftObjects };
}
export async function comparePineExport(input: {
  programId: string;
  accountId: string;
  userId: string;
  exportId: string;
  engine: Array<Record<string, unknown>>;
  tradingview: Array<Record<string, unknown>>;
  context: Record<string, unknown>;
}) {
  await program(input.programId, input.accountId);
  const d = await c2Repository.detail(input.programId, input.accountId),
    exp = d.pine_exports.find((x) => x.pine_export_id === input.exportId);
  if (!exp) throw new Error("pine_export_not_found");
  const report = compareSignals(input.engine, input.tradingview, input.context);
  await c2Repository.saveParity({
    id: randomUUID(),
    accountId: input.accountId,
    programId: input.programId,
    exportId: input.exportId,
    report,
    userId: input.userId,
    createdAt: new Date().toISOString(),
  });
  await c2Repository.updatePineParity(
    input.exportId,
    input.accountId,
    String(report.verdict),
  );
  await appendC2Lifecycle({
    programId: input.programId,
    accountId: input.accountId,
    userId: input.userId,
    eventType: "pine_parity",
    strategySpecHash: String(exp.manifest.strategy_spec_hash),
    codeHash: "pine_bridge_v1",
    dataSnapshotId:
      String(input.context.window_start) +
      ":" +
      String(input.context.window_end),
    payload: {
      script_hash: String(
        (exp.manifest.files as Record<string, unknown>)?.[
          "strategy_visualization.pine"
        ] ?? exp.bundle_hash,
      ),
      strategy_spec_hash: String(exp.manifest.strategy_spec_hash),
      parity_status: report.verdict === "verified" ? "pass" : "fail",
      comparison_artifact_hash: report.report_hash,
      export_id: input.exportId,
    },
  });
  return report;
}
export async function createAlertCredential(input: {
  programId: string;
  accountId: string;
  userId: string;
  exportId: string;
}) {
  await program(input.programId, input.accountId);
  const d = await c2Repository.detail(input.programId, input.accountId);
  if (
    !d.pine_exports.some(
      (x) => x.pine_export_id === input.exportId && x.status === "ready",
    )
  )
    throw new Error("pine_export_not_found");
  const token = randomBytes(32).toString("base64url"),
    id = randomUUID(),
    now = new Date().toISOString(),
    expires = new Date(Date.now() + 90 * 86400000).toISOString();
  await c2Repository.saveCredential({
    id,
    accountId: input.accountId,
    programId: input.programId,
    exportId: input.exportId,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: expires,
    userId: input.userId,
    createdAt: now,
  });
  return {
    credential_id: id,
    token,
    expires_at: expires,
    webhook_path: `/api/tradingview/observe/${token}`,
  };
}
export async function revokeAlertCredential(input: {
  programId: string;
  accountId: string;
  credentialId: string;
}) {
  await program(input.programId, input.accountId);
  await c2Repository.revokeCredential(
    input.credentialId,
    input.accountId,
    new Date().toISOString(),
  );
  return { credential_id: input.credentialId, status: "revoked" };
}
export async function ingestTradingViewObservation(
  token: string,
  payload: Record<string, unknown>,
) {
  const hash = createHash("sha256").update(token).digest("hex"),
    credential = await c2Repository.credentialByHash(hash);
  if (
    !credential ||
    credential.status !== "active" ||
    (credential.expires_at &&
      new Date(String(credential.expires_at)) < new Date())
  )
    throw new Error("webhook_credential_invalid");
  for (const key of [
    "idempotency_key",
    "symbol",
    "timeframe",
    "confirmed_bar_timestamp",
    "side",
    "event_type",
    "strategy_spec_hash",
  ])
    if (!payload[key]) throw new Error(`observation_missing_${key}`);
  if (payload.confirmed !== true) throw new Error("unconfirmed_alert_rejected");
  const accountId = String(credential.account_id),
    programId = String(credential.program_id),
    d = await c2Repository.detail(programId, accountId),
    exp = d.pine_exports.find(
      (x) => x.pine_export_id === credential.pine_export_id,
    );
  const stale =
    exp?.status !== "ready" ||
    payload.strategy_spec_hash !== exp?.manifest.strategy_spec_hash;
  const matchingEngineDecision = d.catalog.some(
    (entry) =>
      ["log", "manifest"].includes(entry.artifact_type) &&
      String(entry.query_payload.symbol ?? "") === String(payload.symbol) &&
      String(
        entry.query_payload.side ?? entry.query_payload.decision ?? "",
      ).toLowerCase() === String(payload.side).toLowerCase() &&
      String(
        entry.query_payload.timestamp ??
          entry.query_payload.confirmed_bar_timestamp ??
          "",
      ) === String(payload.confirmed_bar_timestamp),
  );
  const verificationStatus = stale
    ? "stale_spec"
    : matchingEngineDecision
      ? "matched_engine_signal"
      : "observed_unverified";
  const now = new Date().toISOString(),
    observation = {
      schema_version: "tradingview_signal_observation_v1",
      account_id: accountId,
      program_id: programId,
      pine_export_id: credential.pine_export_id,
      symbol: payload.symbol,
      timeframe: payload.timeframe,
      confirmed_bar_timestamp: payload.confirmed_bar_timestamp,
      received_at: now,
      side: payload.side,
      event_type: payload.event_type,
      payload_hash: canonicalHash(payload),
      idempotency_key: payload.idempotency_key,
      verification_status: verificationStatus,
      observation_only: true,
      order_authority: false,
    };
  const observationId = randomUUID();
  await c2Repository.saveObservation({
    id: observationId,
    accountId,
    programId,
    exportId: String(credential.pine_export_id),
    idempotencyKey: String(payload.idempotency_key),
    payloadHash: observation.payload_hash,
    observation,
    status: observation.verification_status,
    receivedAt: now,
  });
  await ingestExperimentEventIntoMemory(
    {
      experiment_job_event_id: observationId,
      experiment_job_id: String(credential.pine_export_id),
      experiment_plan_id: "tradingview_observation",
      program_id: programId,
      account_id: accountId,
      event_type: "worker_note",
      message: `TradingView ${String(payload.side)} signal observed for ${String(payload.symbol)}.`,
      payload: {
        card_summary: {
          verdict: verificationStatus,
          confidence: matchingEngineDecision ? 0.6 : 0.1,
          cards: [
            {
              card_type: "TradingViewObservationCard",
              data: {
                status: verificationStatus,
                summary: stale
                  ? "Alert belongs to a superseded or changed strategy specification."
                  : matchingEngineDecision
                    ? "Alert matches a cataloged engine signal at the same timestamp and side."
                    : "Alert is retained as unverified observation evidence only.",
                confidence: matchingEngineDecision ? 0.6 : 0.1,
                observation_only: true,
                order_authority: false,
              },
            },
          ],
        },
      },
      created_at: now,
    },
    { detachedFromExperimentJob: true },
  );
  if (exp)
    await appendC2Lifecycle({
      programId,
      accountId,
      userId: String(credential.credential_id),
      actorType: "exchange",
      eventType: "tradingview_observation",
      strategySpecHash: String(exp.manifest.strategy_spec_hash),
      codeHash: "tradingview_alert",
      dataSnapshotId: String(payload.confirmed_bar_timestamp),
      payload: {
        script_hash: String(
          (exp.manifest.files as Record<string, unknown>)?.[
            "strategy_visualization.pine"
          ] ?? exp.bundle_hash,
        ),
        observed_at: now,
        symbol: payload.symbol,
        timeframe: payload.timeframe,
        observation_only: true,
        verification_status: verificationStatus,
      },
    });
  return observation;
}
export async function signedPineFile(
  programId: string,
  accountId: string,
  exportId: string,
  fileName: string,
) {
  await program(programId, accountId);
  if (
    !/^(strategy_visualization\.pine|strategy_simulation\.pine|pine_export_manifest\.json|pine_compatibility_report\.json|pine_parity_report\.json|strategy_spec\.snapshot\.json|README\.md)$/.test(
      fileName,
    )
  )
    throw new Error("pine_file_invalid");
  const d = await c2Repository.detail(programId, accountId),
    exp = d.pine_exports.find((x) => x.pine_export_id === exportId);
  if (!exp) throw new Error("pine_export_not_found");
  if (
    fileName === "strategy_simulation.pine" &&
    !(exp.manifest.files as Record<string, unknown>)?.[fileName]
  )
    throw new Error("pine_simulation_unavailable");
  const key = `${exp.storage_prefix}/${fileName}`;
  return (
    getObjectStorage().getSignedReadUrl?.(key, {
      expiresInSeconds: 300,
      fileName,
    }) ?? key
  );
}
