import { BENCHMARK_IDS, isBenchmarkId, type BenchmarkId } from "@/lib/benchmarks/benchmark-ids";
import type { BenchmarkFrequency, BenchmarkManifest, BenchmarkManifestEntry, BenchmarkSource } from "@/lib/benchmarks/benchmark-types";

interface RawBenchmarkEntry {
  id?: string;
  file?: string;
  frequency?: string;
  source?: string;
}

export class BenchmarkManifestError extends Error {
  constructor(message: string, readonly details: string[] = []) {
    super(message);
    this.name = "BenchmarkManifestError";
  }
}

export function parseBenchmarkManifestYaml(yaml: string): BenchmarkManifest {
  const parsed = parseMinimalYaml(yaml);
  const revision = typeof parsed.revision === "string" && parsed.revision.trim().length > 0 ? parsed.revision : null;
  const rawEntries = Array.isArray(parsed.benchmarks) ? parsed.benchmarks : null;
  if (!rawEntries) {
    throw new BenchmarkManifestError("Benchmark manifest is missing required 'benchmarks' list.", ["Expected a top-level 'benchmarks:' YAML sequence."]);
  }

  const validationErrors: string[] = [];
  const benchmarks = {} as Record<BenchmarkId, BenchmarkManifestEntry>;

  for (const [index, rawEntry] of rawEntries.entries()) {
    const normalized = normalizeRawEntry(rawEntry);
    if (!normalized) {
      validationErrors.push(`benchmarks[${index}] is not a valid object entry.`);
      continue;
    }

    const missingFields = ["id", "file", "frequency", "source"].filter((field) => !normalized[field as keyof RawBenchmarkEntry]);
    if (missingFields.length > 0) {
      validationErrors.push(`benchmarks[${index}] is missing required field(s): ${missingFields.join(", ")}.`);
      continue;
    }

    if (!isBenchmarkId(normalized.id!)) {
      validationErrors.push(`benchmarks[${index}].id must be one of ${BENCHMARK_IDS.join(", ")}, got '${normalized.id}'.`);
      continue;
    }

    if (normalized.frequency !== "1d") {
      validationErrors.push(`benchmarks[${index}].frequency must be '1d', got '${normalized.frequency}'.`);
      continue;
    }

    if (normalized.source !== "platform_managed") {
      validationErrors.push(`benchmarks[${index}].source must be 'platform_managed', got '${normalized.source}'.`);
      continue;
    }

    benchmarks[normalized.id] = {
      id: normalized.id,
      file: normalized.file!,
      frequency: normalized.frequency as BenchmarkFrequency,
      source: normalized.source as BenchmarkSource,
    };
  }

  for (const expectedId of BENCHMARK_IDS) {
    if (!benchmarks[expectedId]) {
      validationErrors.push(`Manifest does not include required benchmark id '${expectedId}'.`);
    }
  }

  if (validationErrors.length > 0) {
    throw new BenchmarkManifestError("Benchmark manifest validation failed.", validationErrors);
  }

  return { revision, benchmarks };
}

function normalizeRawEntry(rawEntry: unknown): RawBenchmarkEntry | null {
  if (!rawEntry || typeof rawEntry !== "object") return null;
  const value = rawEntry as Record<string, unknown>;
  const getString = (key: keyof RawBenchmarkEntry): string | undefined => {
    const raw = value[key];
    return typeof raw === "string" ? raw.trim() : undefined;
  };

  return {
    id: getString("id"),
    file: getString("file"),
    frequency: getString("frequency"),
    source: getString("source"),
  };
}

function parseMinimalYaml(yaml: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const lines = yaml.split(/\r?\n/);
  let currentListKey: string | null = null;
  let currentItem: Record<string, string> | null = null;

  const finalizeCurrentItem = () => {
    if (!currentItem || !currentListKey) return;
    const existing = root[currentListKey];
    if (!Array.isArray(existing)) {
      root[currentListKey] = [currentItem];
      return;
    }
    existing.push(currentItem);
  };

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    if (indent === 0) {
      finalizeCurrentItem();
      currentItem = null;
      currentListKey = null;

      if (trimmed.endsWith(":")) {
        currentListKey = trimmed.slice(0, -1).trim();
        if (!root[currentListKey]) root[currentListKey] = [];
        continue;
      }

      const scalar = parseKeyValue(trimmed);
      if (scalar) root[scalar.key] = scalar.value;
      continue;
    }

    if (!currentListKey) continue;

    if (trimmed.startsWith("- ")) {
      finalizeCurrentItem();
      currentItem = {};
      const maybeInline = trimmed.slice(2).trim();
      if (maybeInline) {
        const kv = parseKeyValue(maybeInline);
        if (kv) currentItem[kv.key] = kv.value;
      }
      continue;
    }

    if (!currentItem) continue;
    const kv = parseKeyValue(trimmed);
    if (kv) currentItem[kv.key] = kv.value;
  }

  finalizeCurrentItem();
  return root;
}

function parseKeyValue(line: string): { key: string; value: string } | null {
  const separator = line.indexOf(":");
  if (separator < 0) return null;
  const key = line.slice(0, separator).trim();
  let value = line.slice(separator + 1).trim();
  value = stripWrappingQuotes(value);
  return { key, value };
}

function stripWrappingQuotes(value: string): string {
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
