import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getObjectStorage } from "../src/lib/server/storage/object-storage";
import { buildPublicationAssetUrl } from "../src/lib/server/publications/repository";
import { buildPublicationCoverObjectKey, buildPublicationObjectKey, buildReportObjectKey, buildUploadObjectKey } from "../src/lib/server/storage/object-keys";

type Counters = { migrated: number; skipped: number; missing: number };

const localStorageRoot = process.env.LOCAL_FILE_MIGRATION_STORAGE_ROOT ?? process.env.INVARIANCE_STORAGE_ROOT ?? path.join(process.cwd(), ".data", "storage");
const localPublicationRoot = process.env.INVARIANCE_PUBLICATION_STORAGE_ROOT ?? path.join(process.cwd(), ".data", "publications");

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function fileExists(target: string) {
  return fs.existsSync(target) && fs.statSync(target).isFile();
}

async function migrateArtifacts(db: DatabaseSync, dryRun: boolean, counters: Counters) {
  const rows = db.prepare("SELECT artifact_id, account_id, file_name, file_type, storage_key FROM artifacts").all() as Array<Record<string, unknown>>;
  for (const row of rows) {
    const currentKey = String(row.storage_key);
    const nextKey = buildUploadObjectKey({
      accountId: String(row.account_id),
      artifactId: String(row.artifact_id),
      fileName: String(row.file_name),
    });
    if (currentKey === nextKey) {
      counters.skipped += 1;
      continue;
    }
    const sourcePath = path.join(localStorageRoot, currentKey);
    if (!fileExists(sourcePath)) {
      counters.missing += 1;
      continue;
    }
    const bytes = new Uint8Array(fs.readFileSync(sourcePath));
    if (!dryRun) {
      await getObjectStorage().putObject({
        bucket: "uploads",
        file_name: String(row.file_name),
        content_type: String(row.file_type || "application/octet-stream"),
        bytes,
        storage_key: nextKey,
      });
      db.prepare("UPDATE artifacts SET storage_key = ? WHERE artifact_id = ?").run(nextKey, String(row.artifact_id));
    }
    counters.migrated += 1;
  }
}

async function migrateExports(db: DatabaseSync, dryRun: boolean, counters: Counters) {
  const rows = db.prepare("SELECT export_id, account_id, analysis_id, format, content_type, storage_key FROM exports WHERE storage_key IS NOT NULL").all() as Array<Record<string, unknown>>;
  for (const row of rows) {
    const currentKey = String(row.storage_key);
    const fileName = `analysis-${String(row.analysis_id)}.${String(row.format)}`;
    const nextKey = buildReportObjectKey({
      accountId: String(row.account_id),
      analysisId: String(row.analysis_id),
      fileName,
    });
    if (currentKey === nextKey) {
      counters.skipped += 1;
      continue;
    }
    const sourcePath = path.join(localStorageRoot, currentKey);
    if (!fileExists(sourcePath)) {
      counters.missing += 1;
      continue;
    }
    const bytes = new Uint8Array(fs.readFileSync(sourcePath));
    if (!dryRun) {
      await getObjectStorage().putObject({
        bucket: "reports",
        file_name: fileName,
        content_type: String(row.content_type || "application/octet-stream"),
        bytes,
        storage_key: nextKey,
      });
      db.prepare("UPDATE exports SET storage_key = ? WHERE export_id = ?").run(nextKey, String(row.export_id));
    }
    counters.migrated += 1;
  }
}

async function migratePublications(db: DatabaseSync, dryRun: boolean, counters: Counters) {
  const rows = db.prepare("SELECT id, slug, cover_image_url, pdf_url, cover_storage_key, pdf_storage_key FROM publications").all() as Array<Record<string, unknown>>;
  for (const row of rows) {
    const publicationId = String(row.id);
    const slug = String(row.slug);

    const publicationTargets = [
      {
        kind: "pdf" as const,
        currentKey: row.pdf_storage_key ? String(row.pdf_storage_key) : undefined,
        legacyUrl: row.pdf_url ? String(row.pdf_url) : undefined,
        nextKey: buildPublicationObjectKey({ publicationId, fileName: `${slug}.pdf` }),
        localPath: path.join(localPublicationRoot, "pdfs", path.basename(String(row.pdf_url ?? `${slug}.pdf`))),
      },
      {
        kind: "cover" as const,
        currentKey: row.cover_storage_key ? String(row.cover_storage_key) : undefined,
        legacyUrl: row.cover_image_url ? String(row.cover_image_url) : undefined,
        nextKey: buildPublicationCoverObjectKey({ publicationId, fileName: `${slug}.png` }),
        localPath: path.join(localPublicationRoot, "covers", path.basename(String(row.cover_image_url ?? `${slug}.png`))),
      },
    ];

    for (const target of publicationTargets) {
      if (target.currentKey === target.nextKey) {
        counters.skipped += 1;
        continue;
      }
      if (!fileExists(target.localPath)) {
        counters.missing += 1;
        continue;
      }
      const bytes = new Uint8Array(fs.readFileSync(target.localPath));
      const fileName = path.basename(target.localPath);
      if (!dryRun) {
        await getObjectStorage().putObject({
          bucket: target.kind === "pdf" ? "publications" : "publication-covers",
          file_name: fileName,
          content_type: target.kind === "pdf" ? "application/pdf" : "image/png",
          bytes,
          storage_key: target.nextKey,
        });
        const routeUrl = buildPublicationAssetUrl({ kind: target.kind, publicationId, fileName });
        if (target.kind === "pdf") {
          db.prepare("UPDATE publications SET pdf_storage_key = ?, pdf_url = ? WHERE id = ?").run(target.nextKey, routeUrl, publicationId);
        } else {
          db.prepare("UPDATE publications SET cover_storage_key = ?, cover_image_url = ? WHERE id = ?").run(target.nextKey, routeUrl, publicationId);
        }
      }
      counters.migrated += 1;
    }
  }
}

async function main() {
  const sqlitePath = readArg("sqlite") ?? process.env.INVARIANCE_DB_PATH ?? path.join(process.cwd(), ".data", "invariance.sqlite");
  const dryRun = hasFlag("dry-run");
  const db = new DatabaseSync(sqlitePath);
  const artifactCounters: Counters = { migrated: 0, skipped: 0, missing: 0 };
  const exportCounters: Counters = { migrated: 0, skipped: 0, missing: 0 };
  const publicationCounters: Counters = { migrated: 0, skipped: 0, missing: 0 };

  await migrateArtifacts(db, dryRun, artifactCounters);
  await migrateExports(db, dryRun, exportCounters);
  await migratePublications(db, dryRun, publicationCounters);

  db.close();

  console.table({
    artifacts: artifactCounters,
    exports: exportCounters,
    publications: publicationCounters,
  });
  if (dryRun) {
    console.log("Dry run only. No database updates or object-storage writes were performed.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
