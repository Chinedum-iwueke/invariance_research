import type { ArtifactValidationError, ArtifactValidationResult, BundleManifestV1 } from "../contracts";
import { bundleManifestV1Schema } from "../schemas";
import { hasZipMagicHeader, indexBundleEntries, type BundleFileEntry } from "../utils/zip";

const REQUIRED_BUNDLE_FILES = ["manifest.json", "trades.csv"] as const;
const OPTIONAL_BUNDLE_FILES = [
  "metadata.json",
  "equity_curve.csv",
  "assumptions.json",
  "params.json",
  "ohlcv.csv",
  "ohlcv.parquet",
  "benchmark.csv",
] as const;

export type BundleValidationInput = {
  zipBytes?: Uint8Array;
  entries: BundleFileEntry[];
};

export type BundleValidationOutput = {
  validation: ArtifactValidationResult;
  manifest?: BundleManifestV1;
  files: Record<string, BundleFileEntry>;
};

export function validateBundleV1(input: BundleValidationInput): BundleValidationOutput {
  const errors: ArtifactValidationError[] = [];
  const warnings: string[] = [];

  if (input.zipBytes && !hasZipMagicHeader(input.zipBytes)) {
    errors.push({ code: "invalid_zip_bundle", message: "Bundle does not have a valid ZIP signature" });
  }

  const files = indexBundleEntries(input.entries);

  for (const requiredFile of REQUIRED_BUNDLE_FILES) {
    if (!files[requiredFile]) {
      errors.push({
        code: requiredFile === "manifest.json" ? "missing_manifest" : "missing_trades_file",
        message: `Required bundle file missing: ${requiredFile}`,
      });
    }
  }

  const manifestEntry = files["manifest.json"];
  let manifest: BundleManifestV1 | undefined;

  if (manifestEntry) {
    try {
      const raw = JSON.parse(manifestEntry.text);
      const parsed = bundleManifestV1Schema.safeParse(raw);
      if (!parsed.success) {
        errors.push({ code: "invalid_manifest", message: parsed.error.issues[0]?.message ?? "Invalid manifest" });
      } else {
        manifest = parsed.data;
      }
    } catch {
      errors.push({ code: "invalid_manifest", message: "manifest.json is not valid JSON" });
    }
  }

  if (manifest) {
    for (const requiredFile of REQUIRED_BUNDLE_FILES) {
      if (!manifest.included_files.includes(requiredFile)) {
        warnings.push(`Manifest omitted expected required file in included_files: ${requiredFile}`);
      }
    }

    const supported = new Set([...REQUIRED_BUNDLE_FILES, ...OPTIONAL_BUNDLE_FILES]);
    const unsupportedFiles = manifest.included_files.filter((file) => !supported.has(file as never));
    if (unsupportedFiles.length > 0) {
      warnings.push(`Manifest includes unsupported optional files: ${unsupportedFiles.join(", ")}`);
    }
  }

  return {
    validation: {
      valid: errors.length === 0,
      errors,
      warnings,
    },
    manifest,
    files,
  };
}
