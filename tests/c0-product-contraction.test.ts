import assert from "node:assert/strict";
import test from "node:test";
import type { ParsedArtifact } from "../src/lib/server/ingestion/contracts";
import { evaluateCryptoArtifactScope, SUPPORTED_MARKET } from "../src/lib/product/market-scope";

function artifact(overrides: Partial<ParsedArtifact> = {}): ParsedArtifact {
  return {
    artifact_kind: "trade_csv",
    artifact_type: "trade_csv",
    richness: "trade_only",
    trades: [],
    ohlcv_present: false,
    benchmark_present: false,
    diagnostic_eligibility: {} as ParsedArtifact["diagnostic_eligibility"],
    validation: { valid: true, errors: [], warnings: [] },
    ...overrides,
  };
}

test("C0 fixes the primary market to crypto", () => {
  assert.equal(SUPPORTED_MARKET, "crypto");
  assert.equal(evaluateCryptoArtifactScope(artifact({
    trades: [{ symbol: "BTCUSDT", side: "long", entry_time: "2026-01-01T00:00:00Z", exit_time: "2026-01-01T01:00:00Z", entry_price: 1, exit_price: 2, quantity: 1 }],
  })).supported, true);
});

test("C0 accepts explicit crypto exchange evidence", () => {
  assert.equal(evaluateCryptoArtifactScope(artifact({
    trades: [{ symbol: "WIF-PERP", exchange: "bybit", side: "long", entry_time: "2026-01-01T00:00:00Z", exit_time: "2026-01-01T01:00:00Z", entry_price: 1, exit_price: 2, quantity: 1 }],
  })).supported, true);
});

test("C0 rejects explicit non-crypto and ambiguous evidence", () => {
  const equity = evaluateCryptoArtifactScope(artifact({
    trades: [{ symbol: "AAPL", market: "equities", side: "long", entry_time: "2026-01-01T00:00:00Z", exit_time: "2026-01-01T01:00:00Z", entry_price: 1, exit_price: 2, quantity: 1 }],
  }));
  const ambiguous = evaluateCryptoArtifactScope(artifact({
    trades: [{ symbol: "MYSTERY", side: "long", entry_time: "2026-01-01T00:00:00Z", exit_time: "2026-01-01T01:00:00Z", entry_price: 1, exit_price: 2, quantity: 1 }],
  }));

  assert.equal(equity.supported, false);
  assert.match(equity.reason, /crypto only/i);
  assert.equal(ambiguous.supported, false);
  assert.match(ambiguous.reason, /could not be verified/i);
});
