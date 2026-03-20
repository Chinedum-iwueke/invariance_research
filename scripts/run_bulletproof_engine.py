#!/usr/bin/env python3
"""Bridge script for invoking the bulletproof_bt runtime module (import name: bt)."""

from __future__ import annotations

import argparse
import inspect
import json
import sys
from typing import Any


def _read_payload(stdin: str) -> dict[str, Any]:
    try:
        payload = json.loads(stdin)
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid_json_input:{exc.msg}") from exc

    if not isinstance(payload, dict):
        raise ValueError("invalid_payload: expected JSON object")

    return payload


def _emit_json(data: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(data, separators=(",", ":"), default=str))
    sys.stdout.write("\n")
    sys.stdout.flush()


def _emit_error(message: str) -> None:
    sys.stderr.write(message)
    sys.stderr.write("\n")
    sys.stderr.flush()


def _invoke_engine_seam(seam: Any, parsed_artifact: Any, config: Any) -> Any:
    signature = inspect.signature(seam)
    if "config" in signature.parameters:
        return seam(parsed_artifact, config=config)
    return seam(parsed_artifact)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run bulletproof engine analysis through a Python bridge")
    parser.add_argument("--probe", action="store_true", help="only verify module import + seam availability")
    args = parser.parse_args()

    try:
        import bt  # type: ignore
    except Exception as exc:  # noqa: BLE001
        _emit_error(f"bt_import_failed:{exc}")
        return 2

    seam = getattr(bt, "run_analysis_from_parsed_artifact", None)
    if not callable(seam):
        _emit_error("engine_entrypoint_missing")
        return 3

    version = getattr(bt, "__version__", None)

    if args.probe:
        _emit_json({"ok": True, "engine_name": "bt", "engine_version": version})
        return 0

    try:
        payload = _read_payload(sys.stdin.read())
        parsed_artifact = payload.get("parsedArtifact")
        config = payload.get("config")
        result = _invoke_engine_seam(seam, parsed_artifact, config)
        _emit_json({"ok": True, "engine_name": "bt", "engine_version": version, "result": result})
        return 0
    except Exception as exc:  # noqa: BLE001
        _emit_error(f"engine_execution_failed:{type(exc).__name__}:{exc}")
        return 4


if __name__ == "__main__":
    raise SystemExit(main())
