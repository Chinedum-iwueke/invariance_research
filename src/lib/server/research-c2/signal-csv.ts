export function parseSignalCsv(raw: string): Array<Record<string, unknown>> {
  if (Buffer.byteLength(raw) > 2_000_000)
    throw new Error("signal_csv_too_large");
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) return [];
  const split = (line: string) => {
    const values: string[] = [];
    let value = "",
      quoted = false;
    for (let index = 0; index < line.length; index++) {
      const char = line[index];
      if (char === '"') {
        if (quoted && line[index + 1] === '"') {
          value += '"';
          index++;
        } else quoted = !quoted;
      } else if (char === "," && !quoted) {
        values.push(value.trim());
        value = "";
      } else value += char;
    }
    if (quoted) throw new Error("signal_csv_unclosed_quote");
    values.push(value.trim());
    return values;
  };
  const headers = split(lines[0]).map((value) => value.toLowerCase());
  const timestampIndex = headers.findIndex((value) =>
    ["timestamp", "time", "datetime", "confirmed_bar_timestamp"].includes(
      value,
    ),
  );
  const sideIndex = headers.findIndex((value) =>
    ["side", "direction", "signal"].includes(value),
  );
  if (timestampIndex < 0 || sideIndex < 0)
    throw new Error("signal_csv_required_columns_missing");
  if (lines.length > 100_001) throw new Error("signal_csv_row_limit_exceeded");
  return lines.slice(1).map((line, rowIndex) => {
    const values = split(line),
      side = String(values[sideIndex] ?? "").toLowerCase();
    if (!["long", "short"].includes(side))
      throw new Error(`signal_csv_side_invalid:${rowIndex + 2}`);
    const timestamp = values[timestampIndex];
    if (!timestamp)
      throw new Error(`signal_csv_timestamp_missing:${rowIndex + 2}`);
    return { timestamp, side };
  });
}
