declare module "bt" {
  export const __version__: string;
  export function run_analysis_from_parsed_artifact(parsedArtifact: unknown, config?: Record<string, unknown>): Promise<unknown>;
}
