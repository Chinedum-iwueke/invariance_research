import type {
  ArtifactValidationError,
  ArtifactValidationResult,
  CanonicalTradeRecord,
} from "../contracts";

export function validateTradeSemantics(trades: CanonicalTradeRecord[]): ArtifactValidationResult {
  const errors: ArtifactValidationError[] = [];

  if (trades.length === 0) {
    errors.push({ code: "invalid_csv_schema", message: "No valid closed trades were provided" });
  }

  trades.forEach((trade, index) => {
    const row = index + 1;
    if (!trade.symbol.trim()) {
      errors.push({ code: "invalid_trade_row", message: "symbol is required", row, field: "symbol" });
    }
    if (trade.quantity <= 0) {
      errors.push({ code: "invalid_trade_row", message: "quantity must be positive", row, field: "quantity" });
    }
    if (trade.entry_price < 0 || trade.exit_price < 0) {
      errors.push({ code: "invalid_trade_row", message: "prices must be non-negative", row });
    }

    const entry = new Date(trade.entry_time).getTime();
    const exit = new Date(trade.exit_time).getTime();
    if (entry >= exit) {
      errors.push({
        code: "invalid_trade_row",
        message: "entry_time must precede exit_time",
        row,
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}
