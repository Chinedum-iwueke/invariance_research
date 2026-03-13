import { genericBundleV1ParserAdapter } from "./generic-bundle-v1";
import { genericTradeCsvParserAdapter } from "./generic-trade-csv";
import { selectParserAdapter } from "./parser-adapter";
import type { ParserAdapter, ParserInput, ParserOutput } from "./types";

const scaffoldedAdapters: ParserAdapter[] = [
  {
    kind: "backtrader_trade_csv",
    canParse: () => false,
    parse: async () => ({ notes: ["Backtrader adapter scaffolded but not implemented"] }),
  },
  {
    kind: "mt5_trade_csv",
    canParse: () => false,
    parse: async () => ({ notes: ["MT5 adapter scaffolded but not implemented"] }),
  },
  {
    kind: "binance_trade_export",
    canParse: () => false,
    parse: async () => ({ notes: ["Binance adapter scaffolded but not implemented"] }),
  },
  {
    kind: "bybit_trade_export",
    canParse: () => false,
    parse: async () => ({ notes: ["Bybit adapter scaffolded but not implemented"] }),
  },
];

export const parserAdapters: ParserAdapter[] = [
  genericBundleV1ParserAdapter,
  genericTradeCsvParserAdapter,
  ...scaffoldedAdapters,
];

export async function parseUploadArtifact(input: ParserInput): Promise<ParserOutput> {
  const adapter = selectParserAdapter(parserAdapters, input);
  if (!adapter) {
    return { notes: ["No parser adapter matched this upload"] };
  }

  return adapter.parse(input);
}
