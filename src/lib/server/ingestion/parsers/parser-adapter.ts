import type { ParserAdapter } from "./types";

export function selectParserAdapter(adapters: ParserAdapter[], input: Parameters<ParserAdapter["canParse"]>[0]): ParserAdapter | undefined {
  return adapters.find((adapter) => adapter.canParse(input));
}
