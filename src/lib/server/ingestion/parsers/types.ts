import type { ParsedArtifact, ParserAdapterKind } from "../contracts";
import type { UploadFileDescriptor } from "../validators/file";
import type { BundleFileEntry } from "../utils/zip";

export type ParserInput = {
  file: UploadFileDescriptor;
  extractedBundleEntries?: BundleFileEntry[];
};

export type ParserOutput = {
  parsed?: ParsedArtifact;
  notes: string[];
};

export interface ParserAdapter {
  kind: ParserAdapterKind;
  canParse(input: ParserInput): boolean;
  parse(input: ParserInput): Promise<ParserOutput>;
}
