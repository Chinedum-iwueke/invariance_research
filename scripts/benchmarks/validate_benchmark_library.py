#!/usr/bin/env python3
"""Validate the managed benchmark library and print an operational summary."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _load_health_snapshot(repo_root: Path) -> dict[str, Any]:
    tsx_eval = (
        "import { getBenchmarkLibraryHealth } from './src/lib/benchmarks/benchmark-library';"
        "(async () => { const health = await getBenchmarkLibraryHealth(); console.log(JSON.stringify(health)); })();"
    )

    result = subprocess.run(
        ["npx", "tsx", "--eval", tsx_eval],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )

    if result.returncode != 0:
        stderr = result.stderr.strip() or "<empty>"
        raise RuntimeError(f"Failed to run TypeScript benchmark healthcheck via tsx: {stderr}")

    stdout = result.stdout.strip()
    if not stdout:
        raise RuntimeError("Benchmark healthcheck returned no output.")

    try:
        return json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Benchmark healthcheck output was not valid JSON: {stdout}") from exc


def _print_summary(health: dict[str, Any]) -> None:
    print("Benchmark Library Validation")
    print("=" * 32)
    print(f"Status:         {health.get('status', 'unknown')}")
    print(f"Manifest path:  {health.get('manifestPath', '<unknown>')}")
    print(f"Revision:       {health.get('revision') or '<none>'}")
    print(f"Entry count:    {health.get('benchmarkEntryCount', 0)}")

    errors = health.get("errors") or []
    if errors:
        print("\nTop-level errors/issues:")
        for error in errors:
            print(f"  - {error}")

    results = health.get("benchmarkResults") or {}
    if results:
        print("\nPer-benchmark results:")
    for benchmark_id in sorted(results.keys()):
        result = results[benchmark_id] or {}
        coverage = result.get("coverage") or {}
        status = "valid" if result.get("isValid") else "invalid"
        print(f"\n* {benchmark_id}: {status}")
        print(f"    Dataset:   {result.get('datasetPath', '<unknown>')}")
        print(
            "    Coverage:  "
            f"start={coverage.get('startTs') or '<none>'}, "
            f"end={coverage.get('endTs') or '<none>'}, "
            f"rows={coverage.get('rowCount') if coverage.get('rowCount') is not None else '<none>'}"
        )

        issues = result.get("issues") or []
        if not issues:
            print("    Issues:    none")
            continue

        print("    Issues:")
        for issue in issues:
            code = issue.get("code", "unknown")
            message = issue.get("message", "<no message>")
            print(f"      - [{code}] {message}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate local benchmark library health.")
    parser.add_argument("--json", action="store_true", help="Emit raw JSON in addition to summary output.")
    args = parser.parse_args()

    repo_root = _repo_root()

    try:
        health = _load_health_snapshot(repo_root)
    except Exception as exc:  # operational guardrail
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    _print_summary(health)

    if args.json:
        print("\nRaw JSON:")
        print(json.dumps(health, indent=2, sort_keys=True))

    status = str(health.get("status", "unhealthy"))
    return 0 if status == "healthy" else 1


if __name__ == "__main__":
    raise SystemExit(main())
