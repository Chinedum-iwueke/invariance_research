# On-Prem Application Hosting Runbook

This document defines the production design and cutover procedure for hosting the Invariance Research website and web application on Invariance-owned infrastructure instead of Vercel.

The acceptance criterion is concrete:

> A user opens `https://www.invarianceresearch.xyz`, reaches the website through Cloudflare, signs in, uses the product, queues work, receives results, and exports artifacts while no request or deployment depends on Vercel.

This runbook is paired with [ON_PREM_POSTGRES_RUNBOOK.md](./ON_PREM_POSTGRES_RUNBOOK.md). The database runbook remains authoritative for Postgres, PgBouncer, database roles, backups, and database recovery. This document is authoritative for the public edge, app VM, Next.js containers, release process, DNS cutover, and web-runtime operations.

## Decision

For the first 100 users, use this production topology:

- Cloudflare remains the public DNS, proxy, DDoS protection, TLS edge, and WAF.
- A dedicated application VM runs Caddy on the host and two identical Next.js containers.
- Caddy is the only public origin process. The Next.js containers bind only to loopback.
- The application VM reaches PgBouncer over a private WireGuard network.
- Postgres and PgBouncer remain on the dedicated database VM.
- Analysis, export, experiment, and execution workers remain on the dedicated worker VM.
- Cloudflare R2 remains the source of truth for uploads, reports, exports, benchmark objects, research sources, and other large artifacts.
- Postgres remains the source of truth for users, accounts, entitlements, queues, programs, metadata, billing state, audit logs, and operational state.
- App releases are immutable container images identified by a Git commit and image digest.
- Schema changes are explicit one-shot operations. Web containers never initialize or mutate the schema at request time.

Do not place Postgres, workers, and the public app on one VM for production. That creates a single security boundary, allows a public web compromise to reach database storage directly, and lets backtest resource spikes impair public requests.

## Target Topology

```text
                                      outbound HTTPS
                              +--------------------------> Cloudflare R2
                              |
Browser                       |                  private WireGuard network
   |                          |             10.77.0.0/24, no public DB port
   | HTTPS                    |                          |
   v                          |                          v
Cloudflare DNS / CDN / WAF / TLS                DB VM: 10.77.0.10
   |                                              PgBouncer :6432
   | HTTPS to origin, Full (strict)                    |
   v                                                   v
App VM: public 443, WireGuard 10.77.0.20           Postgres :5432
   Caddy on host
      |                    |
      | loopback only      | loopback only
      v                    v
   web-a :3101          web-b :3102
      |                    |
      +----------+---------+
                 |
                 | Postgres through PgBouncer, R2 through HTTPS
                 |
Worker VM: WireGuard 10.77.0.30
   analysis-worker
   export-worker
   experiment-worker
   execution-worker
   optional Ollama
```

Cloudflare is an edge and security dependency, but it is not the application host. The website and app execute on the app VM. Removing Vercel does not require giving up Cloudflare, and retaining Cloudflare materially reduces the exposure of a small public origin.

## Why This Is The Right First-100 Architecture

This design deliberately avoids Kubernetes. At the current scale, Kubernetes would add control-plane, secret-management, ingress, storage, and upgrade complexity without removing the main single-region risks.

Two app containers on one VM provide:

- process redundancy
- safe rolling restarts
- health-based routing
- enough Node capacity for the first 100 users
- one simple public origin to patch and monitor

They do not provide host-level high availability. If the app VM or its provider fails, the site is unavailable. That risk is acceptable during controlled testing if there are tested backups, a rebuild procedure, an external monitor, and a warm replacement VM plan. Add a second app VM only after usage justifies the added network and deployment complexity.

## Current Repository Fit And Mandatory Gaps

The current repository already supports this separation:

- `npm run build` and `npm run start` provide the Next.js web runtime.
- `WORKER_MODE=external` keeps heavy jobs out of request processes.
- DB-backed queues coordinate web and worker processes.
- Postgres-backed rate-limit buckets are safe across multiple web replicas.
- R2-backed object storage avoids web-container disk dependence for durable artifacts.
- JWT sessions work across replicas when both containers share the same auth secrets.
- Stripe webhook events are signature checked and persisted through the application billing contract.
- `/api/health` provides a platform-level health snapshot.

The following gaps must be closed before production cutover:

1. Set `output: "standalone"` in `next.config.ts` so the production image can contain only traced runtime dependencies.
2. Add a lightweight `/api/health/live` endpoint that returns `200` when the Next.js process can serve requests without querying Postgres, R2, workers, Stripe, email, or the Python engine.
3. Add `/api/health/ready` for web readiness. It should verify Postgres and required web dependencies, but it must not require a local Python engine because the web runtime intentionally delegates engine work to external workers.
4. Keep `/api/health` as platform health for Admin Ops and external operational diagnosis.
5. Disable production debug routes by leaving `DEBUG_RUNTIME_ENV_TOKEN` unset. A temporary token may be enabled only during an incident and must be removed immediately afterward.
6. Confirm all durable publication and upload paths use R2. The legacy local publication route must not be the production source of truth.
7. Align browser upload messaging with the actual product limits. The current request path buffers the multipart body in Node memory. Do not enable 100-250 MB uploads on this path for the first 100 users.
8. Test multi-instance Next.js caching. Dynamic authenticated pages are already forced dynamic in key app layouts, but any ISR or mutable server cache must either be replica-safe or explicitly disabled for correctness-sensitive pages.
9. Make full platform health worker-mode aware. When `WORKER_MODE=external`, the absence of Python and `bulletproof_bt` in the web image must be reported as `delegated_to_external_worker`, not as a failed local engine. Engine availability should be derived from fresh worker heartbeat/capability evidence.

These are launch blockers, not optional polish.

Next.js recommends a reverse proxy in front of a self-hosted server and documents standalone output for minimal production images. It also warns that each instance has its own default disk and memory cache, so multi-instance cache behavior must be deliberate:

- <https://nextjs.org/docs/app/guides/self-hosting>
- <https://nextjs.org/docs/15/app/api-reference/config/next-config-js/output>

## Capacity Target

### Application VM

Recommended:

- Ubuntu 24.04 LTS or Debian 12
- 4 vCPU
- 8 GB RAM
- 80-100 GB NVMe SSD
- 2-4 GB swap
- 1 Gbps network when available
- provider-level snapshots enabled

Initial web container limits:

- `web-a`: 1.5 CPU, 2 GB memory
- `web-b`: 1.5 CPU, 2 GB memory
- Caddy and host: remaining CPU and memory

The app VM should not run engine workers, Ollama, Postgres, Grafana, or benchmark generation.

### Upgrade Triggers

Scale or split the app tier when any of these remain true for normal traffic:

- host CPU exceeds 60% for 15 minutes
- either web container exceeds 75% of its memory limit
- p95 public request latency exceeds 750 ms excluding deliberate long-poll or stream routes
- event-loop lag exceeds 100 ms repeatedly
- Caddy records upstream connection failures
- app restarts more than once in 24 hours without an intentional deploy
- Postgres connection wait time becomes visible at `POSTGRES_POOL_MAX=5` per replica
- upload concurrency causes memory pressure

## Domain And Canonical URL

Use `www.invarianceresearch.xyz` as the canonical production host because it is the explicit acceptance target.

Set all application URL variables to exactly the same origin:

```env
APP_URL=https://www.invarianceresearch.xyz
AUTH_URL=https://www.invarianceresearch.xyz
NEXTAUTH_URL=https://www.invarianceresearch.xyz
```

Do not include a trailing slash. Simple URL and enum values can remain unquoted in the Docker env file. Use single quotes around literal values containing spaces, `#`, `$`, or other characters that the env parser could interpret. Compose removes syntactic quotes; they do not become part of the application value.

Redirect the apex host to the canonical host:

```text
https://invarianceresearch.xyz/* -> https://www.invarianceresearch.xyz/$1
```

The redirect may be implemented in Caddy and optionally duplicated as a Cloudflare redirect rule.

## DNS Plan

Before cutover, lower the existing record TTL to 300 seconds where Cloudflare exposes a TTL choice.

Create or update:

```text
Type  Name  Target         Proxy status
A     www   APP_VM_IP      Proxied
A     @     APP_VM_IP      Proxied
```

Do not create a DNS-only record containing the app VM IP. Review historical and auxiliary DNS records so the origin IP is not unnecessarily disclosed.

Keep the Vercel records available in a written rollback note until the new origin completes its soak period. Do not leave active conflicting `A`, `AAAA`, or `CNAME` records for `www`.

## Network Segmentation

Use WireGuard between the app, database, and worker VMs.

Suggested addresses:

```text
Database VM  10.77.0.10
App VM       10.77.0.20
Worker VM    10.77.0.30
```

The database VM should allow PgBouncer only from the app and worker VPN addresses:

```bash
sudo ufw allow in on wg0 from 10.77.0.20 to any port 6432 proto tcp
sudo ufw allow in on wg0 from 10.77.0.30 to any port 6432 proto tcp
```

After Vercel is removed, close public PgBouncer access:

```bash
sudo ufw delete allow 6432/tcp
```

Verify it is not public before declaring cutover complete:

```bash
sudo ss -lntp | rg ':5432|:6432'
sudo ufw status numbered
```

Raw Postgres `5432` must remain private to the database host or internal database network. App and worker runtimes should use PgBouncer `6432`.

If the database TLS certificate is issued for `db.invarianceresearch.xyz`, map that name to the WireGuard address on the app and worker hosts:

```text
10.77.0.10 db.invarianceresearch.xyz
```

Then use `sslmode=verify-full`. This preserves hostname verification while routing over the private tunnel.

## App VM OS Preparation

Run as a non-root sudo user:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg git jq ufw fail2ban unattended-upgrades wireguard
sudo hostnamectl set-hostname invariance-app-01
```

Create swap on an 8 GB VM if the provider does not already provide it:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Install Docker from Docker's official repository:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Log out and back in, then verify:

```bash
docker version
docker compose version
```

Install Caddy from the official Caddy package repository:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Compare this sequence with the current official instructions before executing it: <https://caddyserver.com/docs/install#debian-ubuntu-raspbian>. Then verify:

```bash
caddy version
systemctl status caddy --no-pager
```

Enable automatic security updates:

```bash
sudo dpkg-reconfigure --priority=low unattended-upgrades
sudo systemctl enable --now unattended-upgrades
```

## SSH Hardening

Before disabling password access, verify a second SSH session using your key.

Create `/etc/ssh/sshd_config.d/99-invariance-hardening.conf`:

```text
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
X11Forwarding no
AllowTcpForwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
```

Validate and reload:

```bash
sudo sshd -t
sudo systemctl reload ssh
sudo systemctl enable --now fail2ban
```

If you need SSH tunnels for a specific maintenance operation, temporarily override `AllowTcpForwarding`, complete the work, and restore the hardened setting.

## Directory Layout

```bash
sudo mkdir -p /srv/invariance/app/{compose,releases,cache,logs}
sudo mkdir -p /etc/invariance/app
sudo mkdir -p /etc/caddy/certs
sudo chown -R "$USER:$USER" /srv/invariance/app
sudo chown root:root /etc/invariance/app /etc/caddy/certs
sudo chmod 750 /etc/invariance/app /etc/caddy/certs
```

Final layout:

```text
/srv/invariance/app/
  compose/
    docker-compose.app.yml
    release.env
  releases/
  cache/
  logs/

/etc/invariance/app/
  app.env

/etc/caddy/
  Caddyfile
  certs/
    origin.pem
    origin.key
```

Secrets must not live in the Git checkout, image, Compose file, shell history, or `/srv` release directory.

## Cloudflare Origin TLS

Create a Cloudflare Origin CA certificate covering:

```text
invarianceresearch.xyz
*.invarianceresearch.xyz
```

Store it on the app VM:

```text
/etc/caddy/certs/origin.pem
/etc/caddy/certs/origin.key
```

Set permissions:

```bash
sudo chown root:caddy /etc/caddy/certs/origin.pem /etc/caddy/certs/origin.key
sudo chmod 640 /etc/caddy/certs/origin.pem
sudo chmod 640 /etc/caddy/certs/origin.key
```

In Cloudflare, set SSL/TLS encryption mode to `Full (strict)`. Cloudflare documents that Origin CA certificates are intended for proxied origins and that browsers will not trust them when Cloudflare is bypassed. That is desirable here because direct-origin traffic will also be blocked:

- <https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/>
- <https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/>

Record the certificate expiration date in monitoring. Cloudflare does not guarantee an expiration notification for Origin CA certificates.

## Origin Firewall

Start with:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 51820/udp
```

Replace the broad `OpenSSH` rule with a rule scoped to your fixed administration IP or VPN as soon as that path is verified. If WireGuard peers have fixed public IPs, scope UDP `51820` to those IPs. Do not use a blanket `allow in on wg0` rule on the public app VM. Add only the private inbound ports that a documented service actually needs; normal app-to-database traffic is outbound from the app VM.

Allow TCP `443` only from current Cloudflare IPv4 and IPv6 ranges. Retrieve the source lists from:

```text
https://www.cloudflare.com/ips-v4
https://www.cloudflare.com/ips-v6
```

Review the downloaded values before applying them. Then add one UFW rule per range:

```bash
while read -r cidr; do sudo ufw allow from "$cidr" to any port 443 proto tcp; done < cloudflare-ips-v4.txt
while read -r cidr; do sudo ufw allow from "$cidr" to any port 443 proto tcp; done < cloudflare-ips-v6.txt
sudo ufw enable
sudo ufw status verbose
```

Do not publish the Next.js container ports on `0.0.0.0`. They will bind to `127.0.0.1`, which also avoids Docker's documented interaction where published container ports can bypass normal UFW processing:

- <https://docs.docker.com/engine/network/packet-filtering-firewalls/>

Cloudflare recommends allowlisting its current origin-facing ranges and blocking every other source from the origin:

- <https://developers.cloudflare.com/fundamentals/concepts/cloudflare-ip-addresses/>

Add Authenticated Origin Pulls after the base cutover is stable. Zone-level or per-hostname AOP is stronger than the shared global certificate because it authenticates your Cloudflare account rather than only the Cloudflare network:

- <https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/>

## Production Next.js Image

### Required `next.config.ts`

The production prerequisite is:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

Do not bake secrets into `next.config.ts`, build arguments, or public environment variables.

### `Dockerfile.app`

Create this at the repository root:

```dockerfile
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

This web image intentionally does not contain Python, `bulletproof_bt`, browser automation, or worker tooling.

### `.dockerignore`

At minimum:

```text
.git
.github
.next
node_modules
.data
.debug-analysis
deploy/.env.worker
deploy/.env.app
*.log
.env
.env.*
!.env.example
```

Confirm that required public assets are not ignored.

## Web Health Contract

Use three distinct meanings:

```text
/api/health/live   Process liveness only; no external calls; 200 or 503.
/api/health/ready  Lightweight web readiness; Postgres and required web dependencies; 200 or 503.
/api/health        Full platform health; database, R2, billing config, queues, workers, engine availability.
```

Caddy active checks and Docker container health checks must use `/api/health/live`. An external production monitor should check `/api/health/ready`. Readiness must not perform an R2 write-delete probe on every monitor request; cache expensive dependency checks or leave them to full platform health. Admin Ops should continue to inspect `/api/health`.

The current `/api/health` runs local Python and engine probes. In the target architecture that would incorrectly report an intentionally engine-less web image as unhealthy. Before cutover, make the check aware of `WORKER_MODE=external`: report local execution as delegated and use fresh engine-worker evidence for platform readiness.

## Application Compose Stack

Create `/srv/invariance/app/compose/docker-compose.app.yml`:

```yaml
name: invariance-web

x-web-common: &web-common
  image: ${APP_IMAGE:?APP_IMAGE is required}
  init: true
  env_file:
    - /etc/invariance/app/app.env
  restart: unless-stopped
  stop_grace_period: 30s
  read_only: true
  tmpfs:
    - /tmp:size=256m,mode=1777
  cap_drop:
    - ALL
  security_opt:
    - no-new-privileges:true
  pids_limit: 512
  mem_limit: 2g
  cpus: 1.5
  healthcheck:
    test:
      - CMD
      - node
      - -e
      - "fetch('http://127.0.0.1:3000/api/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
    interval: 15s
    timeout: 5s
    start_period: 30s
    retries: 3
  networks:
    - web-internal
  logging:
    driver: json-file
    options:
      max-size: "20m"
      max-file: "5"

services:
  web-a:
    <<: *web-common
    ports:
      - "127.0.0.1:3101:3000"
    volumes:
      - web-a-cache:/app/.next/cache

  web-b:
    <<: *web-common
    ports:
      - "127.0.0.1:3102:3000"
    volumes:
      - web-b-cache:/app/.next/cache

networks:
  web-internal:
    driver: bridge

volumes:
  web-a-cache:
  web-b-cache:
```

Do not add `container_name`. Compose-generated names allow controlled recreation and avoid collisions.

## Runtime Environment

Create `/etc/invariance/app/app.env` and set it to root-readable only:

```bash
sudo install -o root -g root -m 600 /dev/null /etc/invariance/app/app.env
sudoedit /etc/invariance/app/app.env
```

Use this contract:

```env
NODE_ENV=production
APP_ENV=production
APP_URL=https://www.invarianceresearch.xyz
AUTH_URL=https://www.invarianceresearch.xyz
NEXTAUTH_URL=https://www.invarianceresearch.xyz

AUTH_SECRET=GENERATE_A_LONG_RANDOM_SECRET
NEXTAUTH_SECRET=SAME_VALUE_AS_AUTH_SECRET
GOOGLE_CLIENT_ID=SET_FROM_GOOGLE
GOOGLE_CLIENT_SECRET=SET_FROM_GOOGLE
AUTH_REQUIRE_EMAIL_VERIFICATION=true
AUTH_SESSION_DB_CHECK_INTERVAL_MS=300000

PREVIEW_GATE_ENABLED=true
PREVIEW_GATE_PASSWORD=SET_A_PRIVATE_PREVIEW_PASSWORD
PREVIEW_GATE_COOKIE_SECRET=GENERATE_A_SEPARATE_RANDOM_SECRET

DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://invariance_app:URL_ENCODED_PASSWORD@db.invarianceresearch.xyz:6432/invariance_research?sslmode=verify-full
POSTGRES_SCHEMA_AUTO_INIT=false
POSTGRES_POOL_MAX=5
POSTGRES_IDLE_TIMEOUT_MS=10000
POSTGRES_CONNECTION_TIMEOUT_MS=5000

WORKER_MODE=external
ALLOW_EMBEDDED_WORKERS=false
INVARIANCE_EMBEDDED_WORKERS=false
INVARIANCE_WORKER_STALE_MS=120000

INVARIANCE_PLATFORM_PAUSED=false
INVARIANCE_QUEUE_PAUSED=false
INVARIANCE_ANALYSIS_QUEUE_PAUSED=false
INVARIANCE_EXPORT_QUEUE_PAUSED=false
INVARIANCE_EXPERIMENT_QUEUE_PAUSED=false
INVARIANCE_EXECUTION_QUEUE_PAUSED=false
INVARIANCE_ASSISTANT_PAUSED=false

RATE_LIMITS_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_AUTH_MAX=10
RATE_LIMIT_UPLOAD_MAX=20
RATE_LIMIT_ANALYSIS_CREATE_MAX=10
RATE_LIMIT_EXPORT_MAX=20
RATE_LIMIT_SHARE_CREATE_MAX=20
RATE_LIMIT_SHARE_ACCESS_MAX=120
RATE_LIMIT_RESEARCH_DESK_MAX=5
RATE_LIMIT_WAITLIST_MAX=5
RATE_LIMIT_PROGRAM_WRITE_MAX=30
RATE_LIMIT_ASSISTANT_MAX=20
RATE_LIMIT_EXPERIMENT_QUEUE_MAX=10

OBJECT_STORAGE_PROVIDER=r2
OBJECT_STORAGE_BUCKET=invariance-research-prod
OBJECT_STORAGE_REGION=auto
OBJECT_STORAGE_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
OBJECT_STORAGE_ACCESS_KEY_ID=SET_SCOPED_R2_ACCESS_KEY
OBJECT_STORAGE_SECRET_ACCESS_KEY=SET_SCOPED_R2_SECRET
OBJECT_STORAGE_FORCE_PATH_STYLE=true
OBJECT_STORAGE_LIFECYCLE_CONFIGURED=true

BENCHMARK_PROVIDER=object_storage
BENCHMARK_OBJECT_PREFIX=benchmarks
BENCHMARK_MANIFEST_OBJECT_KEY=benchmarks/manifest.v1.yaml
BENCHMARK_MANIFEST_CACHE_TTL_MS=300000

STRIPE_SECRET_KEY=sk_live_SET_ME
STRIPE_WEBHOOK_SECRET=whsec_SET_ME
STRIPE_PRICE_EXPLORER=price_SET_ME
STRIPE_PRICE_PRO=price_SET_ME

EMAIL_PROVIDER=resend
EMAIL_FROM='Invariance Research <reports@invarianceresearch.xyz>'
RESEND_API_KEY=SET_ME

ADMIN_EMAILS=SET_ME
ADMIN_USER_IDS=
RESEARCH_DESK_ADMIN_EMAILS=SET_ME

LLM_INSIGHTS_ENABLED=false
LLM_RESEARCH_ASSISTANT_ENABLED=false
LLM_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
LLM_CREDENTIAL_ENCRYPTION_KEY=GENERATE_A_DEDICATED_RANDOM_SECRET
LLM_INSIGHTS_TIMEOUT_MS=120000
LLM_RESEARCH_ASSISTANT_TIMEOUT_MS=30000
LLM_INPUT_COST_PER_MILLION_USD=0
LLM_OUTPUT_COST_PER_MILLION_USD=0

EXCHANGE_CREDENTIAL_ENCRYPTION_KEY=SAME_VALUE_USED_BY_EXECUTION_WORKER
EXECUTION_INCIDENT_WEBHOOK_URL=
EXECUTION_INCIDENT_WEBHOOK_SECRET=

YOUTUBE_TRANSCRIPT_PROVIDER_URL=
YOUTUBE_TRANSCRIPT_PROVIDER_TOKEN=
DOCUMENT_OCR_PROVIDER_URL=
DOCUMENT_OCR_PROVIDER_TOKEN=
SOURCE_MALWARE_SCAN_URL=
SOURCE_MALWARE_SCAN_TOKEN=
```

Generate secrets independently:

```bash
openssl rand -base64 48
```

Do not reuse the auth, preview cookie, LLM credential, exchange credential, database, or webhook secrets.

Both web replicas must receive identical auth, preview-cookie, encryption, Stripe, and URL values.

## Caddy Configuration

Create `/etc/caddy/Caddyfile`:

```caddyfile
{
    admin 127.0.0.1:2019
}

https://invarianceresearch.xyz {
    tls /etc/caddy/certs/origin.pem /etc/caddy/certs/origin.key
    redir https://www.invarianceresearch.xyz{uri} permanent
}

https://www.invarianceresearch.xyz {
    tls /etc/caddy/certs/origin.pem /etc/caddy/certs/origin.key

    encode zstd gzip

    request_body {
        max_size 55MB
    }

    header {
        -Server
        Strict-Transport-Security "max-age=86400"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
    }

    log {
        output file /var/log/caddy/invariance-access.log {
            roll_size 50MiB
            roll_keep 10
            roll_keep_for 336h
        }
        format json
    }

    reverse_proxy 127.0.0.1:3101 127.0.0.1:3102 {
        lb_policy round_robin
        health_uri /api/health/live
        health_interval 15s
        health_timeout 5s
        health_fails 2
        health_passes 2
        fail_duration 30s
        max_fails 2

        header_up Host {host}
        header_up X-Forwarded-Host {host}
        header_up X-Forwarded-Proto https
        header_up X-Real-IP {http.request.header.CF-Connecting-IP}
        header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
    }
}
```

The origin firewall is part of the trust model for `CF-Connecting-IP`. Do not trust that header if direct public traffic can reach Caddy.

Caddy supports active and passive upstream health checks and warns that forwarded headers need an explicit trust model when a CDN is in front:

- <https://caddyserver.com/docs/caddyfile/directives/reverse_proxy>

Validate before reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

Do not enforce a strict Content Security Policy during the first cutover without browser testing every auth, Stripe, chart, upload, share, and admin flow. Start with `Content-Security-Policy-Report-Only`, inspect violations, then enforce a tested policy.

Start HSTS at one day as shown. After at least one stable week, raise it to one year. Add `includeSubDomains` only after every active subdomain has been inventoried and verified on HTTPS; a premature include rule can make unrelated or internal subdomains inaccessible to browsers.

## Upload Boundary

The application currently reads multipart uploads into the Node process before parsing and sending the durable object to R2. Current paid self-serve plans support at most 50 MB, so Caddy uses a 55 MB request cap for framing overhead.

Cloudflare currently limits request bodies to 100 MB on Free and Pro plans, 200 MB on Business, and 500 MB by default on Enterprise. Requests above the edge limit fail with `413` before reaching the app:

- <https://developers.cloudflare.com/workers/platform/limits/#request-limits>
- <https://developers.cloudflare.com/support/troubleshooting/http-status-codes/4xx-client-error/error-413/>

Do not advertise or enable the existing 100-250 MB entitlement values through this proxy path. Before supporting those sizes, implement direct presigned multipart upload to R2, then pass only the object key and checksum to the app for validation and queueing.

For the first 100 users:

- Free: 10 MB
- Explorer: 25 MB
- Pro: 50 MB
- Research Desk larger files: controlled admin intake or direct-to-R2 workflow only

## Cloudflare Edge Configuration

Set:

- DNS records proxied
- SSL/TLS mode `Full (strict)`
- minimum TLS version `1.2`
- Always Use HTTPS enabled
- Brotli enabled
- WebSockets enabled
- WAF managed rules enabled for the zone plan
- Bot protections enabled conservatively

Create cache rules:

1. Cache `/_next/static/*` aggressively and respect immutable response headers.
2. Bypass cache for `/api/*`.
3. Bypass cache for `/app/*`, `/account/*`, `/login`, `/register`, `/coming-soon`, `/share/*`, and `/program-share/*`.
4. Do not enable a global `Cache Everything` rule.

Create WAF exceptions narrowly:

- Do not challenge `/api/stripe/webhook`; signature verification remains mandatory.
- Do not cache OAuth paths under `/api/auth/*`.
- Allow required Google OAuth redirects and cookies.
- Do not disable all security checks for `/api/*`.

Add edge rate limits for obvious unauthenticated abuse, while retaining the app's Postgres-backed limits:

- login and registration bursts
- preview-gate attempts
- waitlist submissions
- public share-token enumeration
- upload inspection bursts

Edge limits protect the VM. App limits enforce account and product policy.

## Google OAuth Cutover

In Google Cloud Console, add and verify:

```text
Authorized JavaScript origin:
https://www.invarianceresearch.xyz

Authorized redirect URI:
https://www.invarianceresearch.xyz/api/auth/callback/google
```

Keep the old apex callback temporarily only if it is needed during the transition. Remove Vercel preview callback URLs from the production OAuth client after rollback is no longer needed.

Test OAuth in a private browser window after DNS cutover. Existing PKCE cookies from another host are not valid for the new canonical host.

## Stripe Cutover

The canonical production webhook endpoint is:

```text
https://www.invarianceresearch.xyz/api/stripe/webhook
```

In Stripe:

1. Create or update the production webhook endpoint.
2. Subscribe only to events the application handles.
3. Put the new endpoint signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Keep the Vercel endpoint enabled only during a short observation window if duplicate events are replay-safe.
5. Send a test event and confirm a `2xx` response and persisted event record.
6. Disable and then delete the Vercel endpoint after cutover.

Do not configure Cloudflare to cache, rewrite, or interactively challenge the webhook route.

Checkout success and cancel URLs must resolve to the canonical `APP_URL`.

## Email Cutover

Confirm:

- SPF is valid for the email provider.
- DKIM is verified.
- DMARC exists, initially with reporting and later an enforcement policy.
- `EMAIL_FROM` uses a verified domain.
- verification, reset, report, and Research Desk links use `https://www.invarianceresearch.xyz`.

Send a real verification and password-reset email during the smoke test.

## Image Build And Registry

Use GitHub Container Registry or another private registry. Build once in CI, test the same commit, and publish an immutable image:

```text
ghcr.io/OWNER/invariance-research-web:git-SHORT_SHA
ghcr.io/OWNER/invariance-research-web@sha256:DIGEST
```

Production should deploy the digest, not `latest`.

CI sequence:

1. Check out the exact commit.
2. Run `npm ci`.
3. Run the relevant test suites.
4. Run `npm run build`.
5. Build `Dockerfile.app`.
6. Scan the image for critical/high vulnerabilities.
7. Generate an SBOM.
8. Push the commit tag.
9. Resolve and record the digest.
10. Require manual production promotion.

Pin third-party GitHub Actions by commit SHA, protect `main`, require review for workflow changes, and do not expose production SSH or registry credentials to pull-request jobs.

Log in on the app VM without placing the token in shell history:

```bash
read -rsp 'GHCR token: ' GHCR_TOKEN
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u GITHUB_USERNAME --password-stdin
unset GHCR_TOKEN
chmod 600 "$HOME/.docker/config.json"
```

Use a read-packages token only. The app VM must not have a token that can push images or modify the repository.

## Release File

Create `/srv/invariance/app/compose/release.env`:

```env
APP_IMAGE=ghcr.io/OWNER/invariance-research-web@sha256:REPLACE_WITH_DIGEST
```

This file is not a secret, but it is production state and should be root/operator writable only:

```bash
chmod 640 /srv/invariance/app/compose/release.env
```

Record every promotion with:

- Git commit
- image digest
- operator
- timestamp
- schema version or migration command
- smoke-test result
- rollback digest

## First Deployment

From `/srv/invariance/app/compose`:

```bash
docker compose --env-file release.env -f docker-compose.app.yml config
docker compose --env-file release.env -f docker-compose.app.yml pull
docker compose --env-file release.env -f docker-compose.app.yml up -d
docker compose --env-file release.env -f docker-compose.app.yml ps
```

Verify loopback directly before DNS cutover:

```bash
curl -fsS http://127.0.0.1:3101/api/health/live | jq
curl -fsS http://127.0.0.1:3102/api/health/live | jq
curl -fsS http://127.0.0.1:3101/api/health/ready | jq
curl -fsS http://127.0.0.1:3102/api/health/ready | jq
```

Test Caddy from the app VM while setting the production host and resolving it locally:

```bash
curl --resolve www.invarianceresearch.xyz:443:127.0.0.1 \
  --cacert /path/to/cloudflare-origin-ca-root.pem \
  https://www.invarianceresearch.xyz/api/health/live
```

If you use a Cloudflare Origin CA certificate, ordinary direct `curl` trust will fail unless the Origin CA root is explicitly supplied. That does not indicate a browser-facing problem when Cloudflare is proxying in Full (strict) mode.

## Systemd Boot Contract

Create `/etc/systemd/system/invariance-web.service`:

```ini
[Unit]
Description=Invariance Research web containers
Requires=docker.service
After=docker.service network-online.target wg-quick@wg0.service
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/srv/invariance/app/compose
ExecStart=/usr/bin/docker compose --env-file release.env -f docker-compose.app.yml up -d
ExecStop=/usr/bin/docker compose --env-file release.env -f docker-compose.app.yml stop
TimeoutStartSec=180
TimeoutStopSec=90

[Install]
WantedBy=multi-user.target
```

Enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable invariance-web
sudo systemctl start invariance-web
sudo systemctl status invariance-web --no-pager
```

Test one controlled reboot before DNS cutover:

```bash
sudo reboot
```

After reconnecting, verify WireGuard, Docker, both web containers, Caddy, and readiness.

## Rolling Deployment

Assume `release.env` has already been updated to the new digest and the old digest has been recorded.

```bash
cd /srv/invariance/app/compose
docker compose --env-file release.env -f docker-compose.app.yml pull

docker compose --env-file release.env -f docker-compose.app.yml up -d --no-deps web-a
docker compose --env-file release.env -f docker-compose.app.yml ps web-a
curl -fsS http://127.0.0.1:3101/api/health/ready | jq

docker compose --env-file release.env -f docker-compose.app.yml up -d --no-deps web-b
docker compose --env-file release.env -f docker-compose.app.yml ps web-b
curl -fsS http://127.0.0.1:3102/api/health/ready | jq
```

Do not update both replicas simultaneously. Caddy should route around the replica being replaced.

After deployment:

```bash
curl -fsS https://www.invarianceresearch.xyz/api/health/ready | jq
docker compose --env-file release.env -f docker-compose.app.yml logs --since=10m web-a web-b
sudo journalctl -u caddy --since '10 minutes ago' --no-pager
```

## Database Schema During App Releases

Follow expand-and-contract migrations:

1. Add backward-compatible columns/tables first.
2. Run explicit schema initialization or migration once from an operator container.
3. Deploy code that uses the new shape.
4. Backfill if needed.
5. Remove old schema only in a later release after rollback compatibility expires.

Never run schema initialization from both web replicas.

Use the database runbook's one-shot command and keep:

```env
POSTGRES_SCHEMA_AUTO_INIT=false
```

in every long-running container.

## Vercel-To-On-Prem Cutover

### Phase 1: Prepare Without Traffic

- Build and publish the production image.
- Start both web replicas.
- Validate liveness and readiness locally.
- Validate Caddy config.
- Validate database access over WireGuard.
- Validate R2, Stripe config, email config, and worker heartbeats in full platform health.
- Confirm the on-prem database is current and backed up.
- Confirm workers use the same on-prem database and R2 bucket.
- Put the preview gate on if access is still controlled.

### Phase 2: Pre-Cutover Safety Snapshot

- Record current Vercel DNS targets.
- Record current Vercel environment settings without copying secrets into the runbook.
- Take a Postgres backup and verify its checksum.
- Record the currently deployed image digest.
- Set all queue pause switches to `true` if data migration or schema work is still occurring.
- Confirm a tested rollback DNS target exists.

### Phase 3: Switch DNS

- Change `www` and apex records to the app VM and keep them proxied.
- Confirm Cloudflare Full (strict) succeeds.
- Confirm apex redirects to `www`.
- Confirm the certificate shown to a browser is the Cloudflare edge certificate.
- Watch app, Caddy, database, and worker logs continuously.

### Phase 4: Production Smoke Test

Use a dedicated canary account:

1. Open the homepage.
2. Pass the preview gate if enabled.
3. Create an account with email and verify it.
4. Sign out and sign in.
5. Sign in with Google in a private browser.
6. Open Account and Admin Ops with the proper users.
7. Create a research program.
8. Send an assistant message.
9. Upload a supported small trade CSV.
10. Confirm inspection and eligibility.
11. Queue an analysis or experiment.
12. Confirm the external worker claims it.
13. Open the resulting workbench and report.
14. Generate JSON, Markdown, and PDF exports where entitled.
15. Download the export from R2 through the app contract.
16. Create and revoke a share link.
17. Run a Stripe test-mode checkout in staging, or a controlled live checkout/refund in production.
18. Confirm webhook persistence and entitlement update.
19. Submit a Research Desk request.
20. Inspect Admin Health and audit records.

### Phase 5: Soak

Keep Vercel available as a rollback target, but do not route production traffic to it, for 72 hours.

During the soak, track:

- HTTP 5xx rate
- p50 and p95 latency
- container restarts
- memory and CPU
- database pool use and PgBouncer wait time
- queue age and worker heartbeats
- R2 errors
- OAuth failures
- email failures
- Stripe webhook failures
- export failures
- Caddy upstream health state

### Phase 6: Remove Vercel Dependency

After the soak passes:

- disable the Vercel production domain assignment
- disable the old Stripe webhook endpoint
- remove old Google OAuth callback URLs that are no longer needed
- remove Vercel-only environment variables and secrets from Vercel
- stop automatic Vercel production deployments
- close public PgBouncer access previously required by Vercel
- retain deployment history only for audit and rollback documentation
- update internal docs so Vercel is no longer described as production hosting

Do not delete the Vercel project on the cutover day. First prove backups, rollback artifacts, and the new deployment path.

## Acceptance Test For No Vercel Dependency

All conditions must be true:

```bash
curl -fsSI https://www.invarianceresearch.xyz
curl -fsS https://www.invarianceresearch.xyz/api/health/live | jq
curl -fsS https://www.invarianceresearch.xyz/api/health/ready | jq
```

Operational evidence:

- DNS origin is the app VM, proxied by Cloudflare.
- Caddy access logs show the requests.
- One of `web-a` or `web-b` logs the requests.
- Vercel request logs remain empty during the test.
- Temporarily disabling the Vercel deployment does not affect the site.
- Sign-in callbacks use `www.invarianceresearch.xyz`.
- Stripe sends to the on-prem origin through Cloudflare.
- The app reaches on-prem PgBouncer privately.
- Workers and web app read the same database records.
- Uploaded and exported objects are present in R2.

Only then is the acceptance criterion complete.

## Rollback

Rollback has two levels.

### Application Image Rollback

If the new image is bad but infrastructure is healthy:

1. Put the previous digest back into `release.env`.
2. Pull it.
3. Recreate `web-a` and verify readiness.
4. Recreate `web-b` and verify readiness.
5. Confirm production smoke paths.

```bash
docker compose --env-file release.env -f docker-compose.app.yml pull
docker compose --env-file release.env -f docker-compose.app.yml up -d --no-deps web-a
curl -fsS http://127.0.0.1:3101/api/health/ready | jq
docker compose --env-file release.env -f docker-compose.app.yml up -d --no-deps web-b
curl -fsS http://127.0.0.1:3102/api/health/ready | jq
```

### Infrastructure Rollback To Vercel

During the 72-hour soak only:

1. Pause new queues if database compatibility is uncertain.
2. Restore the recorded Vercel DNS target.
3. Ensure Vercel still points to the same on-prem database and R2 state, not an old Supabase or old bucket.
4. Restore required OAuth and Stripe callbacks only if they were already removed.
5. Verify one canary flow.

Do not roll Vercel back to a different database after accepting writes on the on-prem database. That would create split-brain product state.

## Observability

At minimum, collect:

- app VM CPU, memory, disk, load, network, and reboot events
- Docker container state, restart count, CPU, memory, and health
- Caddy request count, status, latency, upstream, and client country/IP metadata as permitted
- Postgres and PgBouncer metrics from the database runbook
- worker heartbeat and queue-age metrics
- R2 operation errors
- application structured errors
- Stripe webhook failures
- authentication failures without logging tokens or credentials

Use an external uptime monitor, not one running only on the app VM. Monitor:

```text
GET https://www.invarianceresearch.xyz/api/health/live
GET https://www.invarianceresearch.xyz/api/health/ready
GET https://www.invarianceresearch.xyz/
```

Alert when:

- liveness fails twice
- readiness fails for two minutes
- either web replica is unhealthy
- both replicas are on the same failed release
- disk exceeds 70%
- memory exceeds 80%
- a container restarts unexpectedly
- TLS certificate has fewer than 30 days remaining
- 5xx exceeds 1% over five minutes
- worker heartbeat is stale
- queue oldest age exceeds the product SLO

Do not put secrets, full `DATABASE_URL`s, session cookies, OAuth codes, Stripe payloads, exchange credentials, user strategy source, or raw uploads into logs.

## Backups And Disaster Recovery

The app containers are disposable. Back up:

- `/etc/invariance/app/app.env`, encrypted before leaving the host
- Caddy configuration and origin certificate material, encrypted
- Compose and release records
- operator deployment ledger
- Postgres through the database runbook
- R2 through versioning/lifecycle policy appropriate to each prefix

Do not back up container writable layers as a recovery strategy.

Recovery targets for the first 100 users:

- app VM RTO: 2 hours
- database RTO: as defined in the Postgres runbook
- database RPO: 15 minutes or better
- R2 recovery: version/lifecycle dependent

Perform a quarterly app-host rebuild drill on a fresh VM:

1. install host dependencies
2. restore encrypted configuration
3. establish WireGuard
4. pull the pinned image
5. start both replicas
6. restore Caddy configuration
7. point a temporary hostname at the VM
8. complete a smoke test

## Security Threat Model

### Public Edge And Origin

Threats:

- direct-origin bypass of Cloudflare
- TLS downgrade or misconfiguration
- forged client IP headers
- malformed or oversized request exhaustion
- credential stuffing and preview-password guessing

Controls:

- Cloudflare proxy and WAF
- Full (strict) origin TLS
- Cloudflare-only origin firewall
- later zone-level Authenticated Origin Pulls
- Caddy body limit and health routing
- Postgres-backed app rate limits
- no public Next.js ports

### Web Containers

Threats:

- remote code execution reaching the host
- dependency compromise
- secret disclosure
- cross-account authorization failure
- SSRF through user-controlled source ingestion

Controls:

- non-root runtime
- read-only root filesystem
- all Linux capabilities dropped
- no Docker socket mount
- no source-code bind mount
- immutable digest-pinned image
- scoped R2 and database credentials
- server-side ownership checks
- governed allowlisted source providers
- egress monitoring and future egress allowlisting

### Database

Threats:

- public exposure
- stolen database credentials
- connection exhaustion
- destructive schema changes
- backup failure

Controls:

- WireGuard-only PgBouncer
- separate app and worker roles
- TLS hostname verification
- bounded pools
- explicit migrations
- tested offsite backups

### Workers And Exchange Execution

Threats:

- web compromise reaching exchange credentials
- unintended live order placement
- replayed commands
- inconsistent projection and exchange state

Controls:

- workers on separate VM
- encrypted connector credentials
- execution key shared only where contractually required
- idempotent commands
- live-canary approval and kill switches
- exchange-authoritative reconciliation
- credential-use audit

### Supply Chain

Threats:

- compromised npm or base image dependency
- malicious CI action
- mutable `latest` deployment
- leaked registry write token

Controls:

- lockfile install
- pinned CI actions
- image scanning and SBOM
- digest promotion
- read-only registry token on app VM
- branch and workflow protection

## Data Classification

Restricted:

- password hashes
- auth and session secrets
- OAuth client secrets
- Stripe secret and webhook keys
- exchange API credentials
- LLM BYOK credentials
- database credentials

Confidential:

- user strategies and hypotheses
- uploaded trade histories
- analysis and research artifacts
- research memory
- account and billing metadata
- deployment state and exchange activity

Internal:

- operational logs
- queue state
- worker heartbeats
- deployment manifests
- health details

Public:

- website pages
- public research publications
- intentionally shared validation reports

The app VM should have only the restricted data required to serve web requests. Exchange credential decryption must remain constrained by the existing worker and server contracts, with audit records for use.

## Incident Procedures

### Both Web Replicas Unhealthy

1. Check host memory, disk, and Docker state.
2. Check database and R2 reachability.
3. Inspect the most recent deploy digest.
4. Roll back the image if the failure began at deploy.
5. Put Cloudflare into a controlled maintenance response if recovery exceeds the SLO.
6. Do not start workers inside the web image as a workaround.

### Database Unreachable

1. Set platform or queue pause controls where possible.
2. Check WireGuard.
3. Check PgBouncer and Postgres health.
4. Check certificate validity and hostname resolution.
5. Check bounded pool usage.
6. Follow the Postgres incident runbook.

### Suspected Web Host Compromise

1. Remove the app VM from Cloudflare origin routing.
2. Preserve provider and host snapshots for investigation.
3. Rotate app database, R2, auth, OAuth, Stripe, email, preview, LLM, and exchange-envelope credentials according to exposure.
4. Rebuild a fresh VM from a known image; do not clean and reuse the compromised host.
5. Deploy a known-good digest.
6. audit account, billing, connector, admin, and object-storage activity during the exposure window.

### R2 Failure

1. Pause uploads and exports while preserving read-only app access when possible.
2. Verify endpoint, scoped credentials, and Cloudflare status.
3. Do not silently fall back to local container storage.
4. Resume only after a write-read-delete probe succeeds.

## Load And Failure Testing

Before inviting users, test staging with production-shaped infrastructure:

- 25 concurrent homepage requests
- 10 concurrent authenticated workspace reads
- 5 concurrent upload inspections at plan-sized files
- queue creation while workers are busy
- export creation and download
- one web replica stopped during active traffic
- one rolling deploy during active traffic
- database connection interruption and recovery
- R2 temporary failure
- stale worker heartbeat
- preview-gate brute-force rate limiting
- Stripe duplicate webhook replay

Pass criteria:

- no cross-account data exposure
- no request routed to the stopped replica after health detection
- no duplicate queued job caused by retries
- no duplicate Stripe entitlement transition
- no durable artifact written only to container disk
- no unbounded memory growth
- no secret in logs
- clear user-facing error when a dependency is unavailable

## Implementation Phases

### H0 - Repository Readiness

Repository: `invariance_research`

- enable Next.js standalone output
- add liveness and web-readiness endpoints
- add production app Dockerfile and `.dockerignore`
- add deployment-contract tests
- ensure no production durable local-file dependency
- verify forwarded-host and canonical URL behavior
- verify multi-replica auth and rate limiting

Exit: the image runs locally with no worker or Python runtime and passes liveness/readiness tests.

### H1 - App VM Foundation

Infrastructure: app VM

- provision VM
- patch OS
- install Docker and Caddy
- harden SSH
- configure UFW and fail2ban
- configure WireGuard
- create directories and permissions

Exit: only SSH, Cloudflare-origin HTTPS, and WireGuard are reachable as intended.

### H2 - Secrets And Private Dependencies

Infrastructure: app VM, DB VM, worker VM

- create app DB role or verify existing role
- move PgBouncer access to WireGuard
- install root-owned app env
- verify R2 and database permissions
- verify encryption-key parity where required

Exit: both app replicas can reach Postgres and R2 without any public database endpoint.

### H3 - Image Pipeline

Repository and CI

- build immutable image
- run tests
- scan dependencies and image
- create SBOM
- push commit tag
- record digest
- protect workflow and registry permissions

Exit: the app VM can pull a digest with read-only credentials.

### H4 - Origin Runtime

Infrastructure: app VM and Cloudflare

- start both web replicas
- install Origin CA cert
- configure Caddy
- configure Full (strict)
- configure Cloudflare-only origin firewall
- configure cache and WAF rules

Exit: production host can be tested through Cloudflare without changing primary DNS traffic.

### H5 - Integration Cutover

External systems

- update Google OAuth
- update Stripe webhook
- verify Resend links and DNS
- verify R2
- verify worker queues and callbacks

Exit: every external callback reaches the new canonical host.

### H6 - DNS Cutover

Infrastructure and operations

- take safety backup
- record rollback state
- switch proxied DNS
- execute full smoke test
- monitor continuously

Exit: public production traffic reaches Caddy and the Next.js containers.

### H7 - Soak And Vercel Removal

Operations

- complete 72-hour soak
- confirm SLOs and no hidden Vercel traffic
- disable Vercel callbacks and production domain
- close public PgBouncer
- remove stale secrets

Exit: disabling Vercel has no observable effect on the product.

### H8 - Recovery Proof

Operations

- rebuild app on a clean VM
- restore encrypted configuration
- deploy pinned digest
- perform smoke test on temporary host
- record RTO

Exit: app recovery is demonstrated, not assumed.

## Final Acceptance Checklist

- [ ] `https://www.invarianceresearch.xyz` loads through Cloudflare.
- [ ] Apex redirects to `www`.
- [ ] Cloudflare uses Full (strict).
- [ ] Direct origin access from a non-Cloudflare IP fails.
- [ ] Caddy is the only public origin service.
- [ ] Next.js ports are loopback-only.
- [ ] Two web replicas are healthy.
- [ ] Stopping either replica does not interrupt the website.
- [ ] Web liveness does not depend on Python or local workers.
- [ ] Web readiness confirms the required web dependencies.
- [ ] Full platform health reports DB, R2, queues, and workers accurately.
- [ ] The app reaches PgBouncer over WireGuard.
- [ ] Public `5432` and `6432` are closed.
- [ ] `POSTGRES_SCHEMA_AUTO_INIT=false` in web and worker runtime.
- [ ] R2 is the durable object source of truth.
- [ ] Upload size behavior matches the product and edge limits.
- [ ] Google sign-in works at the canonical host.
- [ ] Email verification and password reset work.
- [ ] Stripe checkout and replay-safe webhook processing work.
- [ ] External workers claim and complete jobs.
- [ ] PDF, Markdown, and JSON exports complete and download.
- [ ] Share links can be created, accessed, and revoked.
- [ ] Admin Ops and audit trails work.
- [ ] Preview gate works if enabled.
- [ ] App logs contain no secrets or raw user artifacts.
- [ ] External liveness and readiness monitoring alert correctly.
- [ ] Image rollback has been tested.
- [ ] App VM rebuild has been tested.
- [ ] Vercel receives no production requests.
- [ ] Disabling the Vercel deployment does not affect production.

The migration is complete only when every applicable item above is proven with evidence.

## Security Review Boundary

This runbook applies infrastructure and application-security controls based on the current repository contracts. It is not a substitute for an independent penetration test. Before unrestricted public access, commission a professional review focused on authentication, authorization, upload parsing, share links, admin access, SSRF, webhook handling, exchange credentials, and tenant isolation.
