# Production Worker Stack

This stack runs external `analysis-worker` and `export-worker` services with Postgres-backed queueing, Cloudflare R2 object storage, and a colocated Ollama service for LLM-assisted analysis jobs. Research Desk work is still handled inside the web/admin workflow.

## Repository Layout

The Docker build context is `/home/omenka/Projects` so the image can copy both sibling repositories:

- `/home/omenka/Projects/invariance_research`
- `/home/omenka/Projects/bulletproof_bt`

Inside the image, `bulletproof_bt` is installed editable into `/opt/venv`, preserving the local `bt` import used by `scripts/run_bulletproof_engine.py`.

## Start

Run from this `deploy/` directory:

```bash
docker compose -f docker-compose.worker.yml up -d
```

```bash
docker ps
```

```bash
docker logs -f invariance-analysis-worker
```

```bash
docker logs -f invariance-export-worker
```

## Ollama Models

Pull the configured model before processing jobs that require LLM synthesis:

```bash
docker exec -it invariance-ollama ollama pull qwen2.5:14b
```

```bash
docker exec -it invariance-ollama ollama list
```

## Stop

```bash
docker compose -f docker-compose.worker.yml down
```

## Rebuild

```bash
docker compose -f docker-compose.worker.yml up -d --build
```

## Services

- `analysis-worker`: builds from `/home/omenka/Projects` using `invariance_research/Dockerfile.worker`, runs `npm run worker:analysis`, and restarts unless stopped.
- `export-worker`: uses the same image, runs `npm run worker:export`, leases queued export jobs, renders report files, persists them to object storage, and restarts unless stopped.
- `ollama`: runs `ollama/ollama:latest`, exposes `11434:11434`, and persists models in the `ollama-models` Docker volume.

## Health Checks

- `analysis-worker`: validates Postgres connectivity with `SELECT 1` and validates configured object storage by listing the bucket.
- `export-worker`: validates the same Postgres and object-storage dependencies before accepting jobs.
- `ollama`: validates the Ollama process by running `ollama list`.

## Environment

Required variables are stored in `.env.worker`:

- `DATABASE_PROVIDER`
- `DATABASE_URL`
- `INVARIANCE_BENCHMARK_LIBRARY_ROOT`
- `INVARIANCE_EMBEDDED_WORKERS`
- `INVARIANCE_ANALYSIS_WORKER_POLL_MS`
- `INVARIANCE_EXPORT_WORKER_POLL_MS`
- `INVARIANCE_WORKER_STALE_MS`
- `LLM_INSIGHTS_ENABLED`
- `LLM_PROVIDER`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `LLM_INSIGHTS_TIMEOUT_MS`
- `OBJECT_STORAGE_PROVIDER`
- `OBJECT_STORAGE_BUCKET`
- `OBJECT_STORAGE_REGION`
- `OBJECT_STORAGE_ENDPOINT`
- `OBJECT_STORAGE_ACCESS_KEY_ID`
- `OBJECT_STORAGE_SECRET_ACCESS_KEY`
- `OBJECT_STORAGE_FORCE_PATH_STYLE`

`OLLAMA_BASE_URL` must be `http://ollama:11434` inside Docker Compose. Use `http://localhost:11434` only when running the worker directly on the VM host.

## Manual Setup

1. Confirm `/home/omenka/Projects/invariance_research` and `/home/omenka/Projects/bulletproof_bt` both exist on the VM.
2. Confirm Supabase migrations have created the analysis and export queue tables expected by the workers.
3. Confirm the R2 API key pair has read/write/list permissions for `invariance-research-prod`, including exported reports.
4. Pull `qwen2.5:14b` into Ollama before enabling LLM-assisted synthesis for production jobs.
