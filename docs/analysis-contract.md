# Analysis contract architecture

## Why this product-facing schema exists

`invariance_research` now owns a **stable product contract** that sits between backend analysis engines and frontend rendering. The UI consumes this contract only, so frontend behavior remains stable even if engine internals evolve.

## Three-layer separation

1. **Engine schema (`bulletproof_bt`)**
   - Raw computation-oriented objects.
   - Can change as algorithms, simulation internals, or optimization strategies evolve.
2. **Adapter schema (`src/lib/server/adapters/bulletproof`)**
   - Local mapping boundary in `invariance_research`.
   - Converts raw engine outputs to product-safe payloads.
   - Encodes normalization, naming, and fallback decisions.
3. **Product schema (`src/lib/contracts`)**
   - UI-facing and interpretation-friendly.
   - Version-stable API surface for pages/components.
   - Validated at runtime with Zod.

## Integration rules for future `bulletproof_bt` package wiring

- Import raw package result types only inside adapter modules.
- Never leak raw `bulletproof_bt` classes/objects into UI code.
- Map every diagnostic domain into `AnalysisRecord` before returning API payloads.
- Validate payloads with `analysisRecordSchema` before storing/serving.
- If raw fields change, adapt mapper logic without changing product contracts unless product requirements change.

## Figure payload philosophy

Figures are represented as semantic payloads (`FigurePayload`, `FigureSeries`) rather than chart-library configs.
This keeps the contract renderer-agnostic and avoids coupling API responses to a specific charting package.

## Interpretation payload philosophy

Interpretation content is first-class (`InterpretationBlockPayload`) and separate from numerical outputs.
This allows backend/analyst commentary to be explicit and consistent across pages.

## Stability expectations

- `AnalysisRecord` is the canonical analysis artifact.
- New backend capabilities should extend adapters first, then populate existing contract fields.
- Contract changes should be deliberate, versioned, and backward-compatible when possible.
