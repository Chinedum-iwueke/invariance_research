#!/usr/bin/env python3
"""Bridge script for invoking the bulletproof_bt runtime module (import name: bt)."""

from __future__ import annotations

import argparse
import dataclasses
import inspect
import json
import sys
from types import ModuleType
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


class EngineInputValidationError(ValueError):
    """Raised when incoming bridge payload cannot be converted to bt models."""


class EngineContractMismatchError(RuntimeError):
    """Raised when bt exposes an unexpected seam/model contract."""


def _resolve_bt_symbol(bt_module: ModuleType, symbol_name: str) -> Any | None:
    if hasattr(bt_module, symbol_name):
        return getattr(bt_module, symbol_name)

    search_paths = ("saas", "saas.models", "models", "service", "saas.service")
    for path in search_paths:
        current: Any = bt_module
        for part in path.split("."):
            current = getattr(current, part, None)
            if current is None:
                break
        if current is not None and hasattr(current, symbol_name):
            return getattr(current, symbol_name)
    return None


def _coerce_model(value: Any, model_type: Any, *, field_name: str) -> Any:
    if model_type is None:
        return value

    if isinstance(value, model_type):
        return value

    if value is None:
        raise EngineInputValidationError(f"{field_name}: missing required value")

    # Pydantic v2 style
    model_validate = getattr(model_type, "model_validate", None)
    if callable(model_validate):
        try:
            return model_validate(value)
        except Exception as exc:  # noqa: BLE001
            raise EngineInputValidationError(f"{field_name}: {exc}") from exc

    # Pydantic v1 style
    parse_obj = getattr(model_type, "parse_obj", None)
    if callable(parse_obj):
        try:
            return parse_obj(value)
        except Exception as exc:  # noqa: BLE001
            raise EngineInputValidationError(f"{field_name}: {exc}") from exc

    # Dataclass / plain class constructor
    if dataclasses.is_dataclass(model_type):
        if not isinstance(value, dict):
            raise EngineInputValidationError(f"{field_name}: expected object payload")
        try:
            return model_type(**value)
        except Exception as exc:  # noqa: BLE001
            raise EngineInputValidationError(f"{field_name}: {exc}") from exc

    if inspect.isclass(model_type):
        if not isinstance(value, dict):
            raise EngineInputValidationError(f"{field_name}: expected object payload")
        try:
            return model_type(**value)
        except TypeError:
            try:
                return model_type(value)
            except Exception as exc:  # noqa: BLE001
                raise EngineInputValidationError(f"{field_name}: {exc}") from exc
        except Exception as exc:  # noqa: BLE001
            raise EngineInputValidationError(f"{field_name}: {exc}") from exc

    raise EngineContractMismatchError(f"unsupported_model_factory:{field_name}:{model_type}")


def _build_seam_inputs(bt_module: ModuleType, payload: dict[str, Any]) -> tuple[Any, Any]:
    if "parsedArtifact" not in payload:
        raise EngineInputValidationError("parsedArtifact: missing")

    parsed_artifact = payload.get("parsedArtifact")
    config = payload.get("config")

    parsed_artifact_model_type = _resolve_bt_symbol(bt_module, "ParsedArtifactInput")
    config_model_type = _resolve_bt_symbol(bt_module, "AnalysisRunConfig")

    parsed_artifact_input = _coerce_model(parsed_artifact, parsed_artifact_model_type, field_name="parsedArtifact")

    if config is None:
        config_input = None
    elif config_model_type is None:
        config_input = config
    else:
        config_input = _coerce_model(config, config_model_type, field_name="config")

    return parsed_artifact_input, config_input


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
        parsed_artifact, config = _build_seam_inputs(bt, payload)
        result = _invoke_engine_seam(seam, parsed_artifact, config)
        _emit_json({"ok": True, "engine_name": "bt", "engine_version": version, "result": result})
        return 0
    except EngineInputValidationError as exc:
        _emit_error(f"engine_input_validation_failed:{exc}")
        return 5
    except EngineContractMismatchError as exc:
        _emit_error(f"engine_contract_mismatch:{exc}")
        return 6
    except ValueError as exc:
        _emit_error(str(exc))
        return 7
    except Exception as exc:  # noqa: BLE001
        _emit_error(f"engine_execution_failed:{type(exc).__name__}:{exc}")
        return 4


if __name__ == "__main__":
    raise SystemExit(main())
