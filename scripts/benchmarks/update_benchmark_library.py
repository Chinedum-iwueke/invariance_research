#!/usr/bin/env python3
"""Refresh managed benchmark parquet files from public daily data sources.

This operator script is intended for CI/cron or a weekly manual run. It writes
the local benchmark library, then the TypeScript sync script can publish the
same files to object storage for production.
"""

from __future__ import annotations

import csv
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


BENCHMARKS = {
    "BTC": {"symbol": "BTC-USD", "display_symbol": "BTC", "file": "BTC/daily.parquet"},
    "SPY": {"symbol": "SPY", "display_symbol": "SPY", "file": "SPY/daily.parquet"},
    "DXY": {"symbol": "DX-Y.NYB", "display_symbol": "DXY", "file": "DXY/daily.parquet"},
    "XAUUSD": {"symbol": "GC=F", "display_symbol": "XAUUSD", "file": "XAUUSD/daily.parquet"},
}


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def library_root() -> Path:
    override = os.environ.get("INVARIANCE_BENCHMARK_LIBRARY_ROOT")
    if override:
        return Path(override).expanduser().resolve()
    return repo_root() / "platform_data" / "benchmarks"


def yahoo_chart_download(symbol: str, display_symbol: str) -> list[dict[str, object]]:
    period1 = 946684800  # 2000-01-01 UTC; Yahoo BTC starts later automatically.
    period2 = int(time.time())
    encoded = urllib.parse.quote(symbol)
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}"
        f"?period1={period1}&period2={period2}&interval=1d&events=history&includeAdjustedClose=true"
    )
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 InvarianceResearch/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        import json

        payload = json.loads(response.read().decode("utf-8"))

    result = (payload.get("chart", {}).get("result") or [None])[0]
    if not result:
        error = payload.get("chart", {}).get("error")
        raise RuntimeError(f"Yahoo chart API returned no result for {symbol}: {error}")

    timestamps = result.get("timestamp") or []
    quote = ((result.get("indicators", {}).get("quote") or [{}])[0]) or {}
    adjclose = ((result.get("indicators", {}).get("adjclose") or [{}])[0] or {}).get("adjclose") or []
    close = quote.get("close") or []

    rows: list[dict[str, object]] = []
    for index, ts_value in enumerate(timestamps):
        close_value = adjclose[index] if index < len(adjclose) and adjclose[index] is not None else close[index] if index < len(close) else None
        if close_value is None:
            continue
        rows.append({
            "ts": datetime.fromtimestamp(int(ts_value), tz=timezone.utc).date().isoformat(),
            "symbol": display_symbol,
            "close": float(close_value),
        })
    return rows


def stooq_download(symbol: str) -> list[dict[str, object]]:
    url = f"https://stooq.com/q/d/l/?s={urllib.parse.quote(symbol.lower())}&i=d"
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 InvarianceResearch/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        text = response.read().decode("utf-8")
    rows: list[dict[str, object]] = []
    for row in csv.DictReader(text.splitlines()):
        close = row.get("Close")
        if not close:
            continue
        rows.append({"ts": row["Date"], "symbol": symbol.upper(), "close": float(close)})
    return rows


def write_parquet(rows: list[dict[str, object]], output_path: Path) -> None:
    try:
        import pandas as pd
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(f"pandas is required to refresh benchmark data ({exc})") from exc

    if not rows:
        raise RuntimeError(f"No rows downloaded for {output_path}")
    frame = pd.DataFrame(rows)
    frame["ts"] = pd.to_datetime(frame["ts"], utc=True)
    frame = frame.dropna(subset=["ts", "close"]).sort_values("ts").drop_duplicates(subset=["ts"], keep="last")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(output_path, index=False)


def main() -> int:
    root = library_root()
    print(f"Benchmark library root: {root}")
    for benchmark_id, spec in BENCHMARKS.items():
        symbol = str(spec["symbol"])
        display_symbol = str(spec["display_symbol"])
        output_path = root / str(spec["file"])
        rows = yahoo_chart_download(symbol, display_symbol)
        write_parquet(rows, output_path)
        print(f"{benchmark_id}: wrote {len(rows)} rows to {output_path}")

    from subprocess import run

    result = run([sys.executable, "scripts/benchmarks/rebuild_manifest.py"], cwd=repo_root(), check=False)
    if result.returncode != 0:
        return result.returncode

    print(f"Updated at {datetime.now(timezone.utc).isoformat()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
