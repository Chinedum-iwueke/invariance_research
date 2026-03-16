# Phase 6C — Diagnostic Lock Panel System

## Why this exists
The lock panel is a product-trust component. It prevents the UI from collapsing distinct limitations into a generic lock or paywall state.

## Three lock states (must remain distinct)
1. **Artifact Limited**
   - Upload lacks required context.
   - Explain required artifact enrichment.
   - Primary actions: upload richer artifact, format guidance.
   - No primary upgrade CTA.

2. **Engine Limited**
   - Engine cannot yet compute diagnostic credibly.
   - Explain capability boundary and future-support posture.
   - Primary actions: supported diagnostics, advisory review.
   - No primary upgrade CTA.

3. **Plan Locked**
   - Diagnostic entitlement is not included in current plan.
   - Explain current plan, required plan, and unlock value.
   - Primary action: upgrade.

## Component set
- `DiagnosticLockPanel`
- `DiagnosticLockBadge`
- `DiagnosticUnlockRequirements`
- `DiagnosticLockActions`

## Input model
Panel rendering is driven by `buildDiagnosticLockModel(...)` with structured data:
- diagnostic title
- diagnostic purpose
- lock state
- explanation
- unlock requirements
- action hierarchy
- footer trust note

## Action hierarchy
- Artifact and engine states are educational and corrective.
- Plan-locked state is commercial with restrained upgrade flow.

This preserves the rule:
**artifact limitation ≠ engine limitation ≠ plan restriction**.
