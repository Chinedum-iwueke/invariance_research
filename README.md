# Invariance Research Web App

## Scope
- **Phase 1:** Institutional design system and reusable UI kit
- **Phase 2:** Public marketing site with authority, methodology, and conversion pathways
- **Phase 3:** Authenticated product shell architecture for Strategy Robustness Lab

## Run locally

```bash
npm install
npm run dev
```

## Public routes
- `/`
- `/research-standards`
- `/strategy-validation`
- `/robustness-lab`
- `/research`
- `/methodology`
- `/about`
- `/contact`
- `/pricing`
- `/ui-kit`

## Product shell routes
- `/app`
- `/app/new-analysis`
- `/app/analyses`
- `/app/analyses/[id]/overview`
- `/app/analyses/[id]/distribution`
- `/app/analyses/[id]/monte-carlo`
- `/app/analyses/[id]/stability`
- `/app/analyses/[id]/execution`
- `/app/analyses/[id]/regimes`
- `/app/analyses/[id]/ruin`
- `/app/analyses/[id]/report`
- `/app/settings`

Docs:
- `docs/design-system.md`
- `docs/product-shell.md`


## Python engine dependency workflows

### Engine naming distinction

The engine is installed from the **distribution/dependency** named `bulletproof_bt`, but imported at runtime via the **Python module namespace** `bt`.

Correct runtime usage:

```python
import bt

bt.__version__
bt.run_analysis_from_parsed_artifact(parsed_artifact, config)
```

Incorrect runtime usage:

```python
import bulletproof_bt
```

### Local development workflow
If both repositories exist locally:

```
~/Projects/invariance_research
~/Projects/bulletproof_bt
```

install the engine in editable mode:

```bash
pip install -e ~/Projects/bulletproof_bt
```

This editable install overrides the pinned Git dependency during active engine development.

### Reproducible environment workflow
When `bulletproof_bt` is not present locally (CI, Codex containers, deploys), `pip install -e .` resolves `bulletproof_bt` from the pinned Git tag `v0.1.0` declared in `pyproject.toml`.
