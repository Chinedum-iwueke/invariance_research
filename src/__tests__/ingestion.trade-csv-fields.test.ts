import assert from "node:assert/strict";
import test from "node:test";
import { validateTradeCsv } from "@/lib/server/ingestion/validators/trade-csv";

test("trade csv parser preserves mae/mfe and r-multiple sizing fields when present", () => {
  const csv = [
    "entry_time,exit_time,symbol,side,qty,entry_price,exit_price,pnl,fees,mae,mfe,risk_amount,stop_distance,r_multiple_gross,r_multiple_net",
    "2025-01-01T00:00:00Z,2025-01-01T01:00:00Z,BTCUSD,long,2,100,110,20,1,-5,12,50,25,0.4,0.38",
  ].join("\n");

  const output = validateTradeCsv(csv);
  assert.equal(output.validation.valid, true);
  assert.equal(output.trades.length, 1);

  const trade = output.trades[0];
  assert.equal(trade.mae, -5);
  assert.equal(trade.mfe, 12);
  assert.equal(trade.risk_amount, 50);
  assert.equal(trade.stop_distance, 25);
  assert.equal(trade.r_multiple_gross, 0.4);
  assert.equal(trade.r_multiple_net, 0.38);
});
