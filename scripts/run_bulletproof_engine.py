#!/usr/bin/env python3
"""Bridge script for invoking the bulletproof_bt runtime module (import name: bt)."""

from __future__ import annotations

import argparse
import dataclasses
import inspect
import json
import sys
from enum import Enum
from types import ModuleType
from typing import Any, Literal, get_args, get_origin


def _read_payload(stdin: str) -> dict[str, Any]:
    try:
        payload = json.loads(stdin)
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid_json_input:{exc.msg}") from exc

    if not isinstance(payload, dict):
        raise ValueError("invalid_payload: expected JSON object")

    return payload


def _to_json_compatible(value: Any) -> Any:
    """Best-effort conversion of runtime objects into JSON-safe values."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    if isinstance(value, Enum):
        return _to_json_compatible(value.value)

    if dataclasses.is_dataclass(value):
        return _to_json_compatible(dataclasses.asdict(value))

    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        try:
            return _to_json_compatible(model_dump(mode="json"))
        except TypeError:
            try:
                return _to_json_compatible(model_dump())
            except Exception:  # noqa: BLE001
                pass
        except Exception:  # noqa: BLE001
            pass

    dict_method = getattr(value, "dict", None)
    if callable(dict_method):
        try:
            return _to_json_compatible(dict_method())
        except Exception:  # noqa: BLE001
            pass

    if isinstance(value, dict):
        return {str(key): _to_json_compatible(item) for key, item in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [_to_json_compatible(item) for item in value]

    if hasattr(value, "__dict__") and isinstance(value.__dict__, dict):
        return _to_json_compatible(value.__dict__)

    return str(value)


def _emit_json(data: dict[str, Any]) -> None:
    payload = _to_json_compatible(data)
    if not isinstance(payload, dict):
        payload = {"ok": False, "error": "bridge_payload_non_object"}
    sys.stdout.write(json.dumps(payload, separators=(",", ":")))
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


def _safe_isinstance(value: Any, runtime_type: Any) -> bool:
    """Runtime-safe isinstance that tolerates typing generics."""
    try:
        return isinstance(value, runtime_type)
    except TypeError:
        origin = get_origin(runtime_type)
        if origin is None:
            return False
        try:
            return isinstance(value, origin)
        except TypeError:
            return False


def _ensure_dict(value: Any, *, field_name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise EngineInputValidationError(f"root_parsed_artifact_field_mismatch:{field_name}: expected object")
    return value


def _ensure_list(value: Any, *, field_name: str) -> list[Any]:
    if not isinstance(value, list):
        raise EngineInputValidationError(f"root_parsed_artifact_field_mismatch:{field_name}: expected array")
    return value


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


def _coerce_enum_value(raw_value: Any, enum_type: Any, *, field_name: str) -> Any:
    if enum_type is None:
        return raw_value

    if get_origin(enum_type) is Literal:
        literal_choices = get_args(enum_type)
        if raw_value in literal_choices:
            return raw_value
        raise EngineInputValidationError(
            f"enum_conversion_mismatch:{field_name}: got {raw_value!r}; expected one of {list(literal_choices)}"
        )

    if _safe_isinstance(raw_value, enum_type):
        return raw_value

    if raw_value is None:
        raise EngineInputValidationError(f"enum_conversion_mismatch:{field_name}: missing required enum value")

    try:
        return enum_type(raw_value)
    except Exception:  # noqa: BLE001
        pass

    if isinstance(raw_value, str):
        by_name = getattr(enum_type, "__members__", {}).get(raw_value)
        if by_name is not None:
            return by_name
        lowered = raw_value.lower()
        for member_name, member_value in getattr(enum_type, "__members__", {}).items():
            if member_name.lower() == lowered:
                return member_value
        for member in enum_type:
            member_raw = getattr(member, "value", None)
            if isinstance(member_raw, str) and member_raw.lower() == lowered:
                return member

    choices = []
    try:
        choices = [getattr(member, "value", str(member)) for member in enum_type]
    except Exception:  # noqa: BLE001
        choices = list(getattr(enum_type, "__members__", {}).keys())
    raise EngineInputValidationError(
        f"enum_conversion_mismatch:{field_name}: got {raw_value!r}; expected one of {choices}"
    )


def _extract_validation_warnings(parsed_artifact: dict[str, Any]) -> list[str]:
    validation = parsed_artifact.get("validation")
    if not isinstance(validation, dict):
        return []
    warnings = validation.get("warnings")
    if not isinstance(warnings, list):
        return []
    return [str(item) for item in warnings if isinstance(item, str)]


def _to_bool_diagnostic_eligibility(raw_value: Any) -> dict[str, bool]:
    if raw_value is None:
        return {}
    eligibility = _ensure_dict(raw_value, field_name="diagnostic_eligibility")
    mapped: dict[str, bool] = {}
    for diagnostic, status in eligibility.items():
        if isinstance(status, dict):
            availability = status.get("availability")
            mapped[str(diagnostic)] = availability in {"available", "limited", True}
        else:
            mapped[str(diagnostic)] = bool(status)
    return mapped


def _constructor_param_names(model_type: Any) -> set[str] | None:
    if model_type is None:
        return None
    try:
        signature = inspect.signature(model_type)
    except (TypeError, ValueError):
        return None
    params: set[str] = set()
    for name, parameter in signature.parameters.items():
        if name == "self":
            continue
        if parameter.kind in (inspect.Parameter.POSITIONAL_OR_KEYWORD, inspect.Parameter.KEYWORD_ONLY):
            params.add(name)
    return params


def _prune_unknown_kwargs(model_type: Any, value: dict[str, Any]) -> dict[str, Any]:
    accepted = _constructor_param_names(model_type)
    if not accepted:
        return value
    return {key: raw for key, raw in value.items() if key in accepted}


def _adapt_trade(
    bt_module: ModuleType,
    trade: Any,
    *,
    index: int,
) -> Any:
    trade_dict = _ensure_dict(trade, field_name=f"trades[{index}]")
    trade_model_type = _resolve_bt_symbol(bt_module, "NormalizedTradeRecord")
    if trade_model_type is None:
        raise EngineContractMismatchError("unsupported_model_factory:trade:NormalizedTradeRecord missing")

    accepted_fields = _constructor_param_names(trade_model_type)

    aliases: dict[str, tuple[str, ...]] = {
        "symbol": ("symbol",),
        "side": ("side", "direction"),
        "entry_time": ("entry_time", "entry_timestamp"),
        "exit_time": ("exit_time", "exit_timestamp"),
        "entry_price": ("entry_price",),
        "exit_price": ("exit_price",),
        "quantity": ("quantity", "size"),
        "trade_id": ("trade_id", "id"),
        "fees": ("fees", "fee", "commission"),
        "pnl": ("pnl", "profit_loss"),
        "pnl_pct": ("pnl_pct", "return_pct"),
        "mae": ("mae",),
        "mfe": ("mfe",),
        "duration_seconds": ("duration_seconds",),
        "strategy_name": ("strategy_name",),
        "timeframe": ("timeframe",),
        "market": ("market",),
        "exchange": ("exchange",),
        "notes": ("notes",),
        "entry_reason": ("entry_reason",),
        "exit_reason": ("exit_reason",),
        "risk_r": ("risk_r",),
    }

    kwargs: dict[str, Any] = {}
    for dest_name, source_candidates in aliases.items():
        if accepted_fields is not None and dest_name not in accepted_fields:
            continue
        for source_name in source_candidates:
            if source_name in trade_dict and trade_dict[source_name] is not None:
                kwargs[dest_name] = trade_dict[source_name]
                break

    required_min = ("symbol", "side", "entry_time", "exit_time", "entry_price", "exit_price", "quantity")
    for required_name in required_min:
        if accepted_fields is not None and required_name not in accepted_fields:
            continue
        if required_name not in kwargs:
            raise EngineInputValidationError(
                f"trade_field_mismatch:index={index}:missing_required_field:{required_name}"
            )

    try:
        return trade_model_type(**kwargs)
    except Exception as exc:  # noqa: BLE001
        raise EngineInputValidationError(f"trade_field_mismatch:index={index}:{exc}") from exc


def _adapt_parsed_artifact(bt_module: ModuleType, parsed_artifact: Any) -> Any:
    parsed_dict = _ensure_dict(parsed_artifact, field_name="parsedArtifact")
    parsed_model_type = _resolve_bt_symbol(bt_module, "ParsedArtifactInput")
    if parsed_model_type is None:
        raise EngineContractMismatchError("unsupported_model_factory:parsedArtifact:ParsedArtifactInput missing")

    artifact_kind_type = _resolve_bt_symbol(bt_module, "ArtifactKind")
    richness_type = _resolve_bt_symbol(bt_module, "ArtifactRichness")

    artifact_kind_raw = parsed_dict.get("artifact_kind")
    if artifact_kind_raw is None and parsed_dict.get("artifact_type") == "trade_csv":
        artifact_kind_raw = "trade_csv"
    if artifact_kind_raw is None and parsed_dict.get("artifact_type") is not None:
        artifact_kind_raw = "bundle_v1"

    artifact_kind = _coerce_enum_value(artifact_kind_raw, artifact_kind_type, field_name="artifact_kind")
    richness = _coerce_enum_value(parsed_dict.get("richness"), richness_type, field_name="richness")

    raw_trades = _ensure_list(parsed_dict.get("trades"), field_name="trades")
    trades = [_adapt_trade(bt_module, item, index=idx) for idx, item in enumerate(raw_trades)]

    parser_notes = parsed_dict.get("parser_notes")
    if parser_notes is None:
        parser_notes = []
    elif not isinstance(parser_notes, list):
        raise EngineInputValidationError("root_parsed_artifact_field_mismatch:parser_notes: expected array")

    parser_notes_output = [str(item) for item in parser_notes if item is not None]
    parser_notes_output.extend(_extract_validation_warnings(parsed_dict))

    kwargs = {
        "artifact_kind": artifact_kind,
        "richness": richness,
        "trades": trades,
        "strategy_metadata": parsed_dict.get("strategy_metadata") if isinstance(parsed_dict.get("strategy_metadata"), dict) else {},
        "equity_curve": parsed_dict.get("equity_curve") if isinstance(parsed_dict.get("equity_curve"), list) else None,
        "assumptions": parsed_dict.get("assumptions") if isinstance(parsed_dict.get("assumptions"), dict) else None,
        "params": parsed_dict.get("params") if isinstance(parsed_dict.get("params"), dict) else None,
        "ohlcv_present": bool(parsed_dict.get("ohlcv_present", False)),
        "benchmark_present": bool(parsed_dict.get("benchmark_present", False)),
        "parser_notes": parser_notes_output,
        "diagnostic_eligibility": _to_bool_diagnostic_eligibility(parsed_dict.get("diagnostic_eligibility")),
    }

    try:
        return parsed_model_type(**kwargs)
    except Exception as exc:  # noqa: BLE001
        raise EngineInputValidationError(f"root_parsed_artifact_field_mismatch:model_construction:{exc}") from exc


def _coerce_model(value: Any, model_type: Any, *, field_name: str) -> Any:
    if model_type is None:
        return value

    if _safe_isinstance(value, model_type):
        return value

    if value is None:
        raise EngineInputValidationError(f"{field_name}: missing required value")

    # Pydantic v2 style
    model_validate = getattr(model_type, "model_validate", None)
    if callable(model_validate):
        try:
            return model_validate(value)
        except Exception as exc:  # noqa: BLE001
            if isinstance(value, dict):
                pruned = _prune_unknown_kwargs(model_type, value)
                if pruned != value:
                    try:
                        return model_validate(pruned)
                    except Exception:  # noqa: BLE001
                        pass
            raise EngineInputValidationError(f"{field_name}: {exc}") from exc

    # Pydantic v1 style
    parse_obj = getattr(model_type, "parse_obj", None)
    if callable(parse_obj):
        try:
            return parse_obj(value)
        except Exception as exc:  # noqa: BLE001
            if isinstance(value, dict):
                pruned = _prune_unknown_kwargs(model_type, value)
                if pruned != value:
                    try:
                        return parse_obj(pruned)
                    except Exception:  # noqa: BLE001
                        pass
            raise EngineInputValidationError(f"{field_name}: {exc}") from exc

    # Dataclass / plain class constructor
    if dataclasses.is_dataclass(model_type):
        if not isinstance(value, dict):
            raise EngineInputValidationError(f"{field_name}: expected object payload")
        try:
            return model_type(**value)
        except TypeError:
            pruned = _prune_unknown_kwargs(model_type, value)
            if pruned != value:
                try:
                    return model_type(**pruned)
                except Exception as exc:  # noqa: BLE001
                    raise EngineInputValidationError(f"{field_name}: {exc}") from exc
            try:
                return model_type(value)
            except Exception as exc:  # noqa: BLE001
                raise EngineInputValidationError(f"{field_name}: {exc}") from exc
        except Exception as exc:  # noqa: BLE001
            raise EngineInputValidationError(f"{field_name}: {exc}") from exc

    if inspect.isclass(model_type):
        if not isinstance(value, dict):
            raise EngineInputValidationError(f"{field_name}: expected object payload")
        try:
            return model_type(**value)
        except TypeError:
            pruned = _prune_unknown_kwargs(model_type, value)
            if pruned != value:
                try:
                    return model_type(**pruned)
                except Exception:  # noqa: BLE001
                    pass
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

    config_model_type = _resolve_bt_symbol(bt_module, "AnalysisRunConfig")
    parsed_artifact_input = _adapt_parsed_artifact(bt_module, parsed_artifact)

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
