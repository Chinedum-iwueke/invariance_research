#!/usr/bin/env python3
"""Operator bootstrap flow for benchmark library: rebuild (optional) + validate."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _run_step(label: str, command: list[str], cwd: Path) -> int:
    print(f"\n== {label} ==")
    print("$", " ".join(command))
    result = subprocess.run(command, cwd=cwd, check=False)
    return result.returncode


def main() -> int:
    parser = argparse.ArgumentParser(description="Bootstrap benchmark library by rebuilding manifest and validating health.")
    parser.add_argument("--skip-rebuild", action="store_true", help="Skip manifest rebuild and run validation only.")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Return non-zero if any bootstrap step emits warnings or non-healthy status (currently same as validation status).",
    )
    args = parser.parse_args()

    repo_root = _repo_root()

    if not args.skip_rebuild:
        rebuild_code = _run_step(
            "Rebuild benchmark manifest",
            [sys.executable, "scripts/benchmarks/rebuild_manifest.py"],
            cwd=repo_root,
        )
        if rebuild_code != 0:
            print("\nFinal status: UNHEALTHY (manifest rebuild failed)")
            return rebuild_code
    else:
        print("\n== Rebuild benchmark manifest ==")
        print("Skipped (--skip-rebuild).")

    validate_code = _run_step(
        "Validate benchmark library",
        [sys.executable, "scripts/benchmarks/validate_benchmark_library.py"],
        cwd=repo_root,
    )

    if validate_code == 0:
        print("\nFinal status: HEALTHY")
    else:
        print("\nFinal status: DEGRADED/UNHEALTHY")

    if args.strict and validate_code != 0:
        return 1
    return validate_code


if __name__ == "__main__":
    raise SystemExit(main())
