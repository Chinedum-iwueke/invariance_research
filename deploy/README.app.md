# Production Web Application Stack

This directory contains the production application artifacts for the on-prem deployment described in [ON_PREM_APP_HOSTING_RUNBOOK.md](./ON_PREM_APP_HOSTING_RUNBOOK.md).

## Scope

The repository contains everything needed to build and validate the web image. Run the actual release commands on the deployment VM after pulling the intended commit. Do not place populated environment files, database certificates, or private registry credentials in the repository.

## Build On The Deployment VM

From a clean `invariance_research` checkout:

```bash
git pull --ff-only
APP_GIT_SHA="$(git rev-parse --verify HEAD)"
APP_IMAGE="invariance-research-web:git-${APP_GIT_SHA}"
MIGRATION_IMAGE="invariance-research-operations:git-${APP_GIT_SHA}"

docker build --pull \
  --file Dockerfile.app \
  --tag "${APP_IMAGE}" \
  .

docker build \
  --target operations \
  --file Dockerfile.app \
  --tag "${MIGRATION_IMAGE}" \
  .
```

The Docker build runs `npm run build:app`, which fails if the standalone trace contains local state, worker tooling, or more than 300 MiB before static assets. The final image contains only the Next.js standalone server, static assets, and traced Node runtime dependencies. It does not contain Python, `bulletproof_bt`, source tests, local databases, user artifacts, or worker commands.

For public production, CI should publish the tested image to a private registry and `APP_IMAGE` should be a digest such as `ghcr.io/OWNER/invariance-research-web@sha256:...`. A full-commit tag built from a clean checkout is acceptable while the deployment remains a controlled pre-launch environment. Never use `latest`.

## Runtime Files

On the deployment VM:

```bash
sudo install -d -o root -g root -m 0750 /etc/invariance/app
sudo install -o root -g root -m 0600 deploy/.env.app.example /etc/invariance/app/app.env
sudoedit /etc/invariance/app/app.env

sudo install -d -o root -g root -m 0750 /srv/invariance/app/compose
sudo install -o root -g root -m 0640 deploy/docker-compose.app.yml /srv/invariance/app/compose/docker-compose.app.yml
sudo install -o root -g root -m 0640 deploy/release.env.example /srv/invariance/app/compose/release.env
sudoedit /srv/invariance/app/compose/release.env
sudo install -o root -g root -m 0644 deploy/invariance-web.service /etc/systemd/system/invariance-web.service
```

Set `APP_IMAGE` and `MIGRATION_IMAGE` to matching digest or commit-tagged images built from the same commit, and set `APP_GIT_SHA` to the full commit. Populate every placeholder in `app.env`. Keep `POSTGRES_SCHEMA_AUTO_INIT=false`, `WORKER_MODE=external`, and `ALLOW_EMBEDDED_WORKERS=false` in long-running web containers. Use `MIGRATION_IMAGE` only for explicit one-shot operator commands.

## Validate

The repository checks can run on a development or CI machine:

```bash
npm run test:app-deployment
npm run deploy:validate-app -- --env-file /etc/invariance/app/app.env
```

When the deployment VM intentionally has Docker but no host Node/npm installation, run the environment validator through the operations image:

```bash
APP_GIT_SHA="$(git rev-parse --verify HEAD)"
docker build --target operations \
  --file Dockerfile.app \
  --tag "invariance-research-operations:git-${APP_GIT_SHA}" \
  .

sudo docker run --rm \
  --user 0:0 \
  --volume /etc/invariance/app/app.env:/run/invariance/app.env:ro \
  "invariance-research-operations:git-${APP_GIT_SHA}" \
  npm run deploy:validate-app -- --env-file /run/invariance/app.env
```

The validator runs as root only so it can read the root-owned `0600` file and verify its mode. The operations image defaults to the unprivileged `nextjs` user for schema commands.

Validate Compose without starting containers:

```bash
APP_ENV_FILE=.env.app.example \
docker compose --env-file deploy/release.env.example \
  -f deploy/docker-compose.app.yml config --quiet
```

The production `invariance-data-private` network and database CA certificate must exist before container startup.

## Start

The runtime files are root-owned. Enter a root shell for release operations rather than weakening their permissions:

```bash
sudo -i
docker network inspect invariance-data-private >/dev/null 2>&1 \
  || docker network create --driver bridge --internal --subnet 172.29.0.0/24 invariance-data-private

cd /srv/invariance/app/compose
docker image inspect "$(sed -n 's/^APP_IMAGE=//p' release.env)" >/dev/null
docker compose --env-file release.env -f docker-compose.app.yml up -d
docker compose --env-file release.env -f docker-compose.app.yml ps
exit
```

Use `docker compose ... pull` before `up` when `APP_IMAGE` is a registry digest. It is unnecessary for a commit-tagged image built on the same VM.

After the Cloudflare origin certificate and key exist at the paths declared in `Caddyfile.app`, install and validate the proxy configuration:

```bash
sudo install -o root -g root -m 0644 deploy/Caddyfile.app /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

Once the database service unit is installed and both local health checks pass, enable boot recovery:

```bash
sudo systemctl daemon-reload
sudo systemctl enable invariance-web.service
sudo systemctl start invariance-web.service
sudo systemctl status invariance-web.service --no-pager
```

## Health

```bash
curl -fsS http://127.0.0.1:3101/api/health/live
curl -fsS http://127.0.0.1:3102/api/health/live
curl -fsS http://127.0.0.1:3101/api/health/ready
curl -fsS http://127.0.0.1:3102/api/health/ready
```

Use `/api/health/live` for Docker and Caddy process checks. Use `/api/health/ready` for external readiness monitoring. `/api/health` remains the full operational snapshot used by Admin Ops.

Do not continue to Caddy cutover unless both replicas are healthy and both readiness calls return HTTP `200`.
