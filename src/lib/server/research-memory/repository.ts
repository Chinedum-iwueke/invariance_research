import type {
  ProgramRecommendation,
  ResearchFinding,
  ResearchMemoryItem,
  ResearchMemoryLink,
  ResearchMemorySnapshot,
  SimilarRunIndexEntry,
} from "@/lib/server/research-memory/models";
import { getDb } from "@/lib/server/persistence/database";
import { getDatabaseProvider } from "@/lib/server/persistence/provider";
import { getPostgresPool } from "@/lib/server/persistence/postgres";

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function json<T>(value: unknown, fallback: T): T {
  if (value === undefined || value === null) return fallback;
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function mapItem(row: Record<string, unknown>): ResearchMemoryItem {
  return {
    memory_item_id: String(row.memory_item_id),
    account_id: String(row.account_id),
    program_id: String(row.program_id),
    experiment_job_id: row.experiment_job_id ? String(row.experiment_job_id) : undefined,
    memory_type: row.memory_type as ResearchMemoryItem["memory_type"],
    title: String(row.title),
    summary: String(row.summary),
    status: String(row.status),
    confidence: Number(row.confidence ?? 0),
    source_event_id: row.source_event_id ? String(row.source_event_id) : undefined,
    source_card_type: row.source_card_type ? String(row.source_card_type) : undefined,
    source: json<Record<string, unknown>>(row.source_json, {}),
    tags: json<string[]>(row.tags_json, []),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

function mapFinding(row: Record<string, unknown>): ResearchFinding {
  return {
    finding_id: String(row.finding_id),
    account_id: String(row.account_id),
    program_id: String(row.program_id),
    memory_item_id: row.memory_item_id ? String(row.memory_item_id) : undefined,
    finding_type: String(row.finding_type),
    headline: String(row.headline),
    detail: String(row.detail),
    severity: row.severity as ResearchFinding["severity"],
    evidence: json<Record<string, unknown>>(row.evidence_json, {}),
    created_at: iso(row.created_at),
  };
}

function mapRecommendation(row: Record<string, unknown>): ProgramRecommendation {
  return {
    recommendation_id: String(row.recommendation_id),
    account_id: String(row.account_id),
    program_id: String(row.program_id),
    experiment_job_id: row.experiment_job_id ? String(row.experiment_job_id) : undefined,
    recommendation_type: String(row.recommendation_type),
    recommendation: String(row.recommendation),
    status: row.status as ProgramRecommendation["status"],
    confidence: Number(row.confidence ?? 0),
    evidence: json<Record<string, unknown>>(row.evidence_json, {}),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

function mapSimilar(row: Record<string, unknown>): SimilarRunIndexEntry {
  return {
    similar_run_index_id: String(row.similar_run_index_id),
    account_id: String(row.account_id),
    program_id: String(row.program_id),
    experiment_job_id: row.experiment_job_id ? String(row.experiment_job_id) : undefined,
    signature: String(row.signature),
    features: json<Record<string, unknown>>(row.features_json, {}),
    source_memory_item_id: row.source_memory_item_id ? String(row.source_memory_item_id) : undefined,
    created_at: iso(row.created_at),
  };
}

export const researchMemoryRepository = {
  async saveBatch(input: {
    items: ResearchMemoryItem[];
    links: ResearchMemoryLink[];
    findings: ResearchFinding[];
    recommendations: ProgramRecommendation[];
    similar: SimilarRunIndexEntry[];
  }): Promise<void> {
    if (getDatabaseProvider() === "postgres") {
      const pool = getPostgresPool();
      for (const item of input.items) {
        await pool.query(
          `INSERT INTO research_memory_items (memory_item_id, account_id, program_id, experiment_job_id, memory_type, title, summary, status, confidence, source_event_id, source_card_type, source_json, tags_json, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (memory_item_id) DO UPDATE SET summary=EXCLUDED.summary, status=EXCLUDED.status, confidence=EXCLUDED.confidence, source_json=EXCLUDED.source_json, tags_json=EXCLUDED.tags_json, updated_at=EXCLUDED.updated_at`,
          [item.memory_item_id, item.account_id, item.program_id, item.experiment_job_id ?? null, item.memory_type, item.title, item.summary, item.status, item.confidence, item.source_event_id ?? null, item.source_card_type ?? null, JSON.stringify(item.source), JSON.stringify(item.tags), item.created_at, item.updated_at],
        );
      }
      for (const link of input.links) {
        await pool.query(
          `INSERT INTO research_memory_links (memory_link_id, account_id, source_memory_item_id, target_type, target_id, relation, evidence_json, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (memory_link_id) DO NOTHING`,
          [link.memory_link_id, link.account_id, link.source_memory_item_id, link.target_type, link.target_id, link.relation, JSON.stringify(link.evidence), link.created_at],
        );
      }
      for (const finding of input.findings) {
        await pool.query(
          `INSERT INTO research_findings (finding_id, account_id, program_id, memory_item_id, finding_type, headline, detail, severity, evidence_json, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (finding_id) DO NOTHING`,
          [finding.finding_id, finding.account_id, finding.program_id, finding.memory_item_id ?? null, finding.finding_type, finding.headline, finding.detail, finding.severity, JSON.stringify(finding.evidence), finding.created_at],
        );
      }
      for (const recommendation of input.recommendations) {
        await pool.query(
          `INSERT INTO program_recommendations (recommendation_id, account_id, program_id, experiment_job_id, recommendation_type, recommendation, status, confidence, evidence_json, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (recommendation_id) DO UPDATE SET recommendation=EXCLUDED.recommendation, status=EXCLUDED.status, confidence=EXCLUDED.confidence, evidence_json=EXCLUDED.evidence_json, updated_at=EXCLUDED.updated_at`,
          [recommendation.recommendation_id, recommendation.account_id, recommendation.program_id, recommendation.experiment_job_id ?? null, recommendation.recommendation_type, recommendation.recommendation, recommendation.status, recommendation.confidence, JSON.stringify(recommendation.evidence), recommendation.created_at, recommendation.updated_at],
        );
      }
      for (const similar of input.similar) {
        await pool.query(
          `INSERT INTO similar_run_index (similar_run_index_id, account_id, program_id, experiment_job_id, signature, features_json, source_memory_item_id, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (similar_run_index_id) DO NOTHING`,
          [similar.similar_run_index_id, similar.account_id, similar.program_id, similar.experiment_job_id ?? null, similar.signature, JSON.stringify(similar.features), similar.source_memory_item_id ?? null, similar.created_at],
        );
      }
      return;
    }
    const db = getDb();
    const insertItem = db.prepare(
      `INSERT OR REPLACE INTO research_memory_items (memory_item_id, account_id, program_id, experiment_job_id, memory_type, title, summary, status, confidence, source_event_id, source_card_type, source_json, tags_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const item of input.items) {
      insertItem.run(item.memory_item_id, item.account_id, item.program_id, item.experiment_job_id ?? null, item.memory_type, item.title, item.summary, item.status, item.confidence, item.source_event_id ?? null, item.source_card_type ?? null, JSON.stringify(item.source), JSON.stringify(item.tags), item.created_at, item.updated_at);
    }
    const insertLink = db.prepare(
      `INSERT OR IGNORE INTO research_memory_links (memory_link_id, account_id, source_memory_item_id, target_type, target_id, relation, evidence_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const link of input.links) {
      insertLink.run(link.memory_link_id, link.account_id, link.source_memory_item_id, link.target_type, link.target_id, link.relation, JSON.stringify(link.evidence), link.created_at);
    }
    const insertFinding = db.prepare(
      `INSERT OR IGNORE INTO research_findings (finding_id, account_id, program_id, memory_item_id, finding_type, headline, detail, severity, evidence_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const finding of input.findings) {
      insertFinding.run(finding.finding_id, finding.account_id, finding.program_id, finding.memory_item_id ?? null, finding.finding_type, finding.headline, finding.detail, finding.severity, JSON.stringify(finding.evidence), finding.created_at);
    }
    const insertRecommendation = db.prepare(
      `INSERT OR REPLACE INTO program_recommendations (recommendation_id, account_id, program_id, experiment_job_id, recommendation_type, recommendation, status, confidence, evidence_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const recommendation of input.recommendations) {
      insertRecommendation.run(recommendation.recommendation_id, recommendation.account_id, recommendation.program_id, recommendation.experiment_job_id ?? null, recommendation.recommendation_type, recommendation.recommendation, recommendation.status, recommendation.confidence, JSON.stringify(recommendation.evidence), recommendation.created_at, recommendation.updated_at);
    }
    const insertSimilar = db.prepare(
      `INSERT OR IGNORE INTO similar_run_index (similar_run_index_id, account_id, program_id, experiment_job_id, signature, features_json, source_memory_item_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const similar of input.similar) {
      insertSimilar.run(similar.similar_run_index_id, similar.account_id, similar.program_id, similar.experiment_job_id ?? null, similar.signature, JSON.stringify(similar.features), similar.source_memory_item_id ?? null, similar.created_at);
    }
  },

  async listSnapshot(accountId: string, programId?: string): Promise<ResearchMemorySnapshot> {
    const clause = programId ? "account_id = ? AND program_id = ?" : "account_id = ?";
    const params = programId ? [accountId, programId] : [accountId];
    if (getDatabaseProvider() === "postgres") {
      const pgClause = programId ? "account_id = $1 AND program_id = $2" : "account_id = $1";
      const [items, findings, recommendations, similar] = await Promise.all([
        getPostgresPool().query(`SELECT * FROM research_memory_items WHERE ${pgClause} ORDER BY created_at DESC LIMIT 100`, params),
        getPostgresPool().query(`SELECT * FROM research_findings WHERE ${pgClause} ORDER BY created_at DESC LIMIT 100`, params),
        getPostgresPool().query(`SELECT * FROM program_recommendations WHERE ${pgClause} ORDER BY created_at DESC LIMIT 100`, params),
        getPostgresPool().query(`SELECT * FROM similar_run_index WHERE ${pgClause} ORDER BY created_at DESC LIMIT 100`, params),
      ]);
      return {
        items: items.rows.map(mapItem),
        findings: findings.rows.map(mapFinding),
        recommendations: recommendations.rows.map(mapRecommendation),
        similar_runs: similar.rows.map(mapSimilar),
      };
    }
    return {
      items: (getDb().prepare(`SELECT * FROM research_memory_items WHERE ${clause} ORDER BY created_at DESC LIMIT 100`).all(...params) as Record<string, unknown>[]).map(mapItem),
      findings: (getDb().prepare(`SELECT * FROM research_findings WHERE ${clause} ORDER BY created_at DESC LIMIT 100`).all(...params) as Record<string, unknown>[]).map(mapFinding),
      recommendations: (getDb().prepare(`SELECT * FROM program_recommendations WHERE ${clause} ORDER BY created_at DESC LIMIT 100`).all(...params) as Record<string, unknown>[]).map(mapRecommendation),
      similar_runs: (getDb().prepare(`SELECT * FROM similar_run_index WHERE ${clause} ORDER BY created_at DESC LIMIT 100`).all(...params) as Record<string, unknown>[]).map(mapSimilar),
    };
  },

  async search(accountId: string, query: string): Promise<ResearchMemoryItem[]> {
    const needle = `%${query.trim().toLowerCase()}%`;
    if (!query.trim()) return [];
    if (getDatabaseProvider() === "postgres") {
      const result = await getPostgresPool().query(
        `SELECT * FROM research_memory_items
         WHERE account_id = $1
           AND (LOWER(title) LIKE $2 OR LOWER(summary) LIKE $2 OR LOWER(status) LIKE $2 OR LOWER(tags_json::text) LIKE $2)
         ORDER BY created_at DESC
         LIMIT 50`,
        [accountId, needle],
      );
      return result.rows.map(mapItem);
    }
    const rows = getDb()
      .prepare(
        `SELECT * FROM research_memory_items
         WHERE account_id = ?
           AND (LOWER(title) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(status) LIKE ? OR LOWER(tags_json) LIKE ?)
         ORDER BY created_at DESC
         LIMIT 50`,
      )
      .all(accountId, needle, needle, needle, needle) as Record<string, unknown>[];
    return rows.map(mapItem);
  },
};
