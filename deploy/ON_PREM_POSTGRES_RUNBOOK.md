# On-Prem Postgres Runbook

This document defines the production design for replacing managed Supabase Postgres with an Invariance-owned Postgres deployment on a VM.

The goal is not just "run Postgres somewhere." The goal is a database setup that can safely support:

- Vercel-hosted web app requests.
- External worker containers: analysis, export, experiment, and execution workers.
- Auth, accounts, billing state, usage limits, research programs, queues, reports, connector metadata, and audit records.
- Cloudflare R2 object storage for large artifacts.
- A future move from one VM to a replicated or managed-by-us cluster without changing the product data contract.

## Decision

Invariance Research will use self-owned Postgres as the production source of truth.

For the current VM phase:

- Postgres runs in Docker on a hardened Linux VM.
- PgBouncer runs beside Postgres and is the runtime endpoint for Vercel and workers.
- Schema initialization remains explicit and manual through `npm run db:init:postgres`.
- Vercel and workers continue to use the existing app contract:

```env
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://...
POSTGRES_SCHEMA_AUTO_INIT=false
```

SQLite remains local-development only.

## Product-Specific Database Responsibilities

This database is not a disposable queue. It owns the product's operational truth:

- user identities and account records
- admin roles and plan overrides
- subscriptions, Stripe webhook replay records, and entitlements
- usage counters and monthly limits
- uploaded artifact metadata
- analysis runs and analysis jobs
- export jobs and report snapshots
- share-room metadata
- research programs, briefs, hypotheses, strategy specs, and experiment jobs
- worker heartbeats
- exchange connector metadata and encrypted credential envelopes
- deployment commands, events, projections, incidents, and audit logs

Large binary objects should not live in Postgres. Uploads, exported PDFs, generated reports, benchmark data, and engine artifacts belong in Cloudflare R2. Postgres stores keys, manifests, provenance, status, and audit state.

## Target Topology

Recommended first production topology:

```text
                         public HTTPS
Browser  ---------------> Vercel web app
                              |
                              | postgres:// via TLS, pool_max=1
                              v
                       db.invarianceresearch.xyz:6432
                              |
                              v
                         PgBouncer VM
                              |
                              v
                         Postgres VM
                              ^
                              |
             worker containers via TLS or private network
                              |
          analysis / export / experiment / execution workers
                              |
                              v
                       Cloudflare R2 artifacts
```

The cleanest version is a dedicated database VM. If cost or operational simplicity requires one VM at first, Postgres may run on the same VM as the worker containers, but it should still be treated as its own production service with separate directories, backups, firewall rules, and credentials.

## Important Vercel Networking Reality

Vercel serverless functions need to reach the Postgres endpoint. If your Vercel plan does not provide static outbound IPs or a private network path, you have three choices:

1. Use Vercel static egress or a private networking product, then firewall Postgres/PgBouncer to that egress range.
2. Expose PgBouncer publicly with TLS, strong SCRAM passwords, low pool sizes, logging, fail2ban, and strict database roles.
3. Move the web app runtime onto your own infrastructure later so the database stays private.

For the current Vercel-hosted product, option 2 may be the practical first step. It is acceptable for a controlled first-user rollout only if TLS, strong credentials, monitoring, backups, and firewall hardening are all in place.

Do not expose raw Postgres on `5432` publicly unless you have a strong reason. Prefer exposing PgBouncer on `6432` and binding direct Postgres access to localhost or a private interface.

## VM Sizing

For first 100 users:

- Minimum: 2 vCPU, 4 GB RAM, 50 GB NVMe SSD.
- Recommended: 4 vCPU, 8 GB RAM, 100 GB NVMe SSD.
- Storage: SSD/NVMe only. Avoid low-IOPS network disks for the primary database.
- OS: Ubuntu 24.04 LTS or Debian 12.
- Timezone: UTC.
- Swap: 2-4 GB, especially on a 4 GB VM.
- Backups: local plus offsite R2 copy.

Upgrade triggers:

- sustained CPU above 60%
- memory pressure or swap activity
- database disk above 70%
- p95 query latency rising during normal traffic
- connection queueing in PgBouncer
- backups taking too long to complete inside the maintenance window

## DNS

Create a DNS record:

```text
db.invarianceresearch.xyz -> DATABASE_VM_PUBLIC_IP
```

If you are not ready to expose the database publicly, use a private hostname inside your network and point workers at that hostname. Vercel will still need a reachable endpoint until the web app is also moved onto your infrastructure.

## Directory Layout On The VM

Use one root folder for database operations:

```bash
sudo mkdir -p /srv/invariance/postgres/{data,backups,archive,certs,conf,pgbouncer,init,logs}
sudo chown -R "$USER:$USER" /srv/invariance/postgres
chmod 700 /srv/invariance/postgres/data
chmod 700 /srv/invariance/postgres/backups
chmod 700 /srv/invariance/postgres/certs
```

Recommended final layout:

```text
/srv/invariance/postgres/
  docker-compose.postgres.yml
  .env.postgres
  conf/
    postgresql.conf
    pg_hba.conf
  pgbouncer/
    pgbouncer.ini
    userlist.txt
  certs/
    server.crt
    server.key
  data/
  backups/
  archive/
  logs/
```

Never commit `.env.postgres`, database passwords, `userlist.txt`, or private keys.

## OS Preparation

Run on the database VM:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg ufw fail2ban openssl jq postgresql-client python3
```

Install Docker and the Compose plugin:

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

Log out and back in so the Docker group applies, then verify:

```bash
docker version
docker compose version
```

Set the hostname:

```bash
sudo hostnamectl set-hostname invariance-db-01
```

Enable a small swap file if the VM has 4 GB RAM:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Firewall

Start conservative:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
```

If workers are on a known VM IP:

```bash
sudo ufw allow from WORKER_VM_PUBLIC_IP to any port 6432 proto tcp
```

If Vercel static egress is available:

```bash
sudo ufw allow from VERCEL_EGRESS_IP_1 to any port 6432 proto tcp
sudo ufw allow from VERCEL_EGRESS_IP_2 to any port 6432 proto tcp
```

If you must expose PgBouncer publicly while still hosted on Vercel without fixed egress:

```bash
sudo ufw allow 6432/tcp
```

Do not publicly allow direct Postgres unless you are deliberately using direct Postgres as the runtime endpoint:

```bash
# Avoid this for normal runtime:
# sudo ufw allow 5432/tcp
```

Enable firewall:

```bash
sudo ufw enable
sudo ufw status verbose
```

## TLS

Production database traffic should use TLS.

Preferred: issue a real certificate for `db.invarianceresearch.xyz` using Let's Encrypt or your certificate provider. Put the resulting files here:

```text
/srv/invariance/postgres/certs/server.crt
/srv/invariance/postgres/certs/server.key
```

Permissions:

```bash
chmod 600 /srv/invariance/postgres/certs/server.key
chmod 644 /srv/invariance/postgres/certs/server.crt
```

For first testing only, a self-signed cert can work, but it will reintroduce the kind of TLS confusion that already caused production incidents. Use a real cert as soon as this endpoint is exposed to Vercel.

## Secrets

Generate strong passwords:

```bash
openssl rand -base64 48
openssl rand -base64 48
openssl rand -base64 48
```

Use separate passwords for:

- `POSTGRES_SUPERUSER_PASSWORD`
- `INVARIANCE_OWNER_PASSWORD`
- `INVARIANCE_APP_PASSWORD`
- `INVARIANCE_WORKER_PASSWORD` if workers use a separate role
- `PGBOUNCER_ADMIN_PASSWORD`

URL-encode passwords before placing them in `DATABASE_URL`:

```bash
node -p 'encodeURIComponent(process.argv[1])' 'paste-password-here'
```

If Node is not installed on the database VM:

```bash
python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' 'paste-password-here'
```

In Vercel environment variables, do not wrap values in quotes. Use:

```text
DATABASE_URL=postgresql://...
```

not:

```text
DATABASE_URL="postgresql://..."
```

## Database Roles

Use separate database roles:

- `postgres`: superuser, emergency/admin only.
- `invariance_owner`: schema owner and one-shot migrations/schema initialization.
- `invariance_app`: Vercel runtime role.
- `invariance_worker`: worker runtime role.
- `invariance_readonly`: optional read-only diagnostics role.

The current app schema initializer reads `DATABASE_URL`. That means schema setup must be run with an owner URL, then normal web and worker runtime should switch back to runtime URLs.

## Docker Compose For Postgres And PgBouncer

Create `/srv/invariance/postgres/.env.postgres`:

```env
POSTGRES_SUPERUSER_PASSWORD=replace_with_superuser_password
INVARIANCE_DB=invariance_research
INVARIANCE_OWNER_PASSWORD=replace_with_owner_password
INVARIANCE_APP_PASSWORD=replace_with_app_password
INVARIANCE_WORKER_PASSWORD=replace_with_worker_password
PGBOUNCER_ADMIN_PASSWORD=replace_with_pgbouncer_admin_password
```

Create `/srv/invariance/postgres/docker-compose.postgres.yml`:

```yaml
name: invariance-postgres

services:
  postgres:
    image: postgres:16-bookworm
    container_name: invariance-postgres
    restart: unless-stopped
    env_file:
      - .env.postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_SUPERUSER_PASSWORD}
      POSTGRES_DB: postgres
      PGDATA: /var/lib/postgresql/data/pgdata
    command:
      - postgres
      - -c
      - config_file=/etc/postgresql/postgresql.conf
      - -c
      - hba_file=/etc/postgresql/pg_hba.conf
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - ./data:/var/lib/postgresql/data
      - ./conf/postgresql.conf:/etc/postgresql/postgresql.conf:ro
      - ./conf/pg_hba.conf:/etc/postgresql/pg_hba.conf:ro
      - ./certs:/etc/postgresql/certs:ro
      - ./init:/docker-entrypoint-initdb.d:ro
      - ./archive:/var/lib/postgresql/archive
      - ./logs:/var/log/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d postgres"]
      interval: 30s
      timeout: 5s
      retries: 5
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "5"

  pgbouncer:
    image: bitnami/pgbouncer:1.24.1
    container_name: invariance-pgbouncer
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    env_file:
      - .env.postgres
    environment:
      POSTGRESQL_HOST: postgres
      POSTGRESQL_PORT: "5432"
      POSTGRESQL_DATABASE: ${INVARIANCE_DB}
      POSTGRESQL_USERNAME: invariance_app
      POSTGRESQL_PASSWORD: ${INVARIANCE_APP_PASSWORD}
      PGBOUNCER_DATABASE: ${INVARIANCE_DB}
      PGBOUNCER_PORT: "6432"
      PGBOUNCER_POOL_MODE: transaction
      PGBOUNCER_MAX_CLIENT_CONN: "300"
      PGBOUNCER_DEFAULT_POOL_SIZE: "30"
      PGBOUNCER_MIN_POOL_SIZE: "5"
      PGBOUNCER_RESERVE_POOL_SIZE: "10"
      PGBOUNCER_AUTH_TYPE: scram-sha-256
      PGBOUNCER_IGNORE_STARTUP_PARAMETERS: extra_float_digits
      PGBOUNCER_SERVER_RESET_QUERY: DISCARD ALL
      PGBOUNCER_ADMIN_USERS: postgres
      PGBOUNCER_STATS_USERS: postgres
    ports:
      - "6432:6432"
    healthcheck:
      test: ["CMD-SHELL", "PGPASSWORD=$${INVARIANCE_APP_PASSWORD} psql -h 127.0.0.1 -p 6432 -U invariance_app -d $${INVARIANCE_DB} -c 'SELECT 1' >/dev/null"]
      interval: 30s
      timeout: 5s
      retries: 5
    logging:
      driver: json-file
      options:
        max-size: "20m"
        max-file: "5"
```

Notes:

- Direct Postgres is bound to `127.0.0.1:5432`. Use SSH or local VM access for owner/migration work.
- PgBouncer is published on `6432` for Vercel/workers.
- Vercel should use PgBouncer with `POSTGRES_POOL_MAX=1`.
- Worker containers may also use PgBouncer. If they use direct Postgres, keep their pool small.

## Postgres Configuration

Create `/srv/invariance/postgres/conf/postgresql.conf`:

```conf
listen_addresses = '*'
port = 5432

password_encryption = scram-sha-256

ssl = on
ssl_cert_file = '/etc/postgresql/certs/server.crt'
ssl_key_file = '/etc/postgresql/certs/server.key'

max_connections = 100
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
work_mem = 16MB

checkpoint_timeout = 15min
checkpoint_completion_target = 0.9
wal_buffers = 16MB
min_wal_size = 1GB
max_wal_size = 4GB

idle_in_transaction_session_timeout = 30000
statement_timeout = 120000
lock_timeout = 10000

log_destination = 'stderr'
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d.log'
log_min_duration_statement = 500
log_line_prefix = '%m [%p] %u@%d %r '
log_connections = on
log_disconnections = on
log_lock_waits = on

timezone = 'UTC'
```

For a 4 GB VM, use smaller memory settings:

```conf
shared_buffers = 1GB
effective_cache_size = 3GB
maintenance_work_mem = 256MB
work_mem = 8MB
```

Create `/srv/invariance/postgres/conf/pg_hba.conf`:

```conf
# TYPE  DATABASE             USER                ADDRESS          METHOD
local   all                  all                                  scram-sha-256
hostssl all                  all                 127.0.0.1/32     scram-sha-256
hostssl all                  all                 ::1/128          scram-sha-256

# Docker network access from PgBouncer.
hostssl invariance_research  invariance_app      172.16.0.0/12    scram-sha-256
hostssl invariance_research  invariance_worker   172.16.0.0/12    scram-sha-256

# Add explicit worker VM/private network CIDRs here if workers connect directly.
# hostssl invariance_research invariance_worker WORKER_PRIVATE_CIDR scram-sha-256
```

If you expose direct Postgres to a private worker network, add only that network. Do not add `0.0.0.0/0` for direct Postgres.

## Initial Database Bootstrap

Create `/srv/invariance/postgres/init/001-invariance.sql` before the first container boot:

```sql
\set owner_password `echo "$INVARIANCE_OWNER_PASSWORD"`
\set app_password `echo "$INVARIANCE_APP_PASSWORD"`
\set worker_password `echo "$INVARIANCE_WORKER_PASSWORD"`

CREATE ROLE invariance_owner LOGIN PASSWORD :'owner_password';
CREATE ROLE invariance_app LOGIN PASSWORD :'app_password';
CREATE ROLE invariance_worker LOGIN PASSWORD :'worker_password';

CREATE DATABASE invariance_research OWNER invariance_owner;

\connect invariance_research

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO invariance_owner;

GRANT CONNECT ON DATABASE invariance_research TO invariance_app;
GRANT CONNECT ON DATABASE invariance_research TO invariance_worker;
GRANT USAGE ON SCHEMA public TO invariance_app;
GRANT USAGE ON SCHEMA public TO invariance_worker;

ALTER DEFAULT PRIVILEGES FOR ROLE invariance_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO invariance_app;
ALTER DEFAULT PRIVILEGES FOR ROLE invariance_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO invariance_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE invariance_owner IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO invariance_app;
ALTER DEFAULT PRIVILEGES FOR ROLE invariance_owner IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO invariance_worker;
```

The official Postgres image runs files under `/docker-entrypoint-initdb.d` only when the data directory is empty. If you need to re-run bootstrap, do not delete the production data directory. Apply corrective SQL manually.

Start the database:

```bash
cd /srv/invariance/postgres
docker compose -f docker-compose.postgres.yml up -d
docker compose -f docker-compose.postgres.yml ps
docker logs --tail=100 invariance-postgres
docker logs --tail=100 invariance-pgbouncer
```

Verify direct Postgres locally:

```bash
cd /srv/invariance/postgres
set -a
source .env.postgres
set +a

PGPASSWORD="$INVARIANCE_OWNER_PASSWORD" \
psql -h 127.0.0.1 -p 5432 -U invariance_owner -d invariance_research -c 'SELECT current_user, current_database();'
```

Verify PgBouncer locally:

```bash
PGPASSWORD="$INVARIANCE_APP_PASSWORD" \
psql -h 127.0.0.1 -p 6432 -U invariance_app -d invariance_research -c 'SELECT current_user, current_database();'
```

## Product Schema Initialization

The app's schema initializer uses `DATABASE_URL`. Run it once with a direct owner connection.

From a VM that has the `invariance_research` code and Docker worker image:

```bash
cd /srv/invariance/invariance_research

OWNER_PASSWORD_ENCODED="$(node -p 'encodeURIComponent(process.argv[1])' "$INVARIANCE_OWNER_PASSWORD")"
DATABASE_OWNER_URL="postgresql://invariance_owner:${OWNER_PASSWORD_ENCODED}@DB_HOST_OR_IP:5432/invariance_research?sslmode=require&uselibpqcompat=true"

INVARIANCE_STACK_ROOT=/srv/invariance \
docker compose -f deploy/docker-compose.worker.yml run --rm \
  -e DATABASE_PROVIDER=postgres \
  -e DATABASE_URL="$DATABASE_OWNER_URL" \
  -e POSTGRES_SCHEMA_AUTO_INIT=true \
  analysis-worker npm run db:init:postgres
```

Expected output:

```text
Postgres schema is initialized.
```

After schema initialization, runtime processes should go back to their runtime role URL.

If running directly on a machine with Node installed:

```bash
cd /srv/invariance/invariance_research
DATABASE_PROVIDER=postgres \
DATABASE_URL="$DATABASE_OWNER_URL" \
POSTGRES_SCHEMA_AUTO_INIT=true \
npm run db:init:postgres
```

## Runtime Database URLs

### Vercel Runtime URL

Use PgBouncer:

```env
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://invariance_app:URL_ENCODED_APP_PASSWORD@db.invarianceresearch.xyz:6432/invariance_research?sslmode=require&uselibpqcompat=true
POSTGRES_SCHEMA_AUTO_INIT=false
POSTGRES_POOL_MAX=1
POSTGRES_IDLE_TIMEOUT_MS=10000
POSTGRES_CONNECTION_TIMEOUT_MS=5000
```

If you use a public CA certificate and the hostname exactly matches the certificate, `sslmode=verify-full` is preferable:

```env
DATABASE_URL=postgresql://invariance_app:URL_ENCODED_APP_PASSWORD@db.invarianceresearch.xyz:6432/invariance_research?sslmode=verify-full
```

The current app health check accepts `sslmode=require` with `uselibpqcompat=true`, or `sslmode=verify-full`.

### Worker Runtime URL

Use PgBouncer unless there is a reason to bypass it:

```env
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://invariance_worker:URL_ENCODED_WORKER_PASSWORD@db.invarianceresearch.xyz:6432/invariance_research?sslmode=require&uselibpqcompat=true
POSTGRES_SCHEMA_AUTO_INIT=false
POSTGRES_POOL_MAX=2
POSTGRES_IDLE_TIMEOUT_MS=10000
POSTGRES_CONNECTION_TIMEOUT_MS=5000
INVARIANCE_WORKER_DB_ERROR_BACKOFF_MS=300000
```

For workers on the same private network as Postgres, direct Postgres is acceptable:

```env
DATABASE_URL=postgresql://invariance_worker:URL_ENCODED_WORKER_PASSWORD@PRIVATE_DB_IP:5432/invariance_research?sslmode=require&uselibpqcompat=true
POSTGRES_POOL_MAX=2
```

Keep worker pool sizes small until query load is measured.

## Vercel Cutover

1. Set kill switches before database cutover:

```env
INVARIANCE_PLATFORM_PAUSED=true
INVARIANCE_QUEUE_PAUSED=true
INVARIANCE_ANALYSIS_QUEUE_PAUSED=true
INVARIANCE_EXPORT_QUEUE_PAUSED=true
INVARIANCE_EXPERIMENT_QUEUE_PAUSED=true
INVARIANCE_EXECUTION_QUEUE_PAUSED=true
INVARIANCE_ASSISTANT_PAUSED=true
```

2. Stop worker containers:

```bash
cd /srv/invariance/invariance_research
INVARIANCE_STACK_ROOT=/srv/invariance \
docker compose -f deploy/docker-compose.worker.yml down
```

3. If migrating data from Supabase, take a final dump after traffic is paused.

4. Restore the dump into on-prem Postgres.

5. Run `npm run db:init:postgres` against the on-prem owner URL.

6. Update Vercel environment variables:

```env
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://invariance_app:URL_ENCODED_APP_PASSWORD@db.invarianceresearch.xyz:6432/invariance_research?sslmode=require&uselibpqcompat=true
POSTGRES_SCHEMA_AUTO_INIT=false
POSTGRES_POOL_MAX=1
```

7. Redeploy Vercel.

8. Confirm Admin Health shows:

```text
database: healthy postgres
postgres_pool: healthy pool_max=1
```

9. Update `deploy/.env.worker` on the worker VM with the on-prem runtime URL.

10. Rebuild/restart workers:

```bash
cd /srv/invariance/invariance_research
git pull

INVARIANCE_STACK_ROOT=/srv/invariance \
docker compose -f deploy/docker-compose.worker.yml up -d --build analysis-worker export-worker experiment-worker execution-worker
```

11. Unpause the platform only after smoke tests pass.

## Supabase To On-Prem Migration

Export from Supabase from a trusted machine:

```bash
pg_dump "$SUPABASE_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file=/tmp/invariance_supabase_final.dump
```

Copy the dump to the DB VM:

```bash
scp /tmp/invariance_supabase_final.dump USER@DB_VM:/srv/invariance/postgres/backups/
```

Restore into on-prem:

```bash
cd /srv/invariance/postgres
set -a
source .env.postgres
set +a

PGPASSWORD="$INVARIANCE_OWNER_PASSWORD" \
pg_restore \
  --host=127.0.0.1 \
  --port=5432 \
  --username=invariance_owner \
  --dbname=invariance_research \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  /srv/invariance/postgres/backups/invariance_supabase_final.dump
```

Then run app schema initialization to add any missing columns/tables from the current code:

```bash
DATABASE_PROVIDER=postgres DATABASE_URL="$DATABASE_OWNER_URL" POSTGRES_SCHEMA_AUTO_INIT=true npm run db:init:postgres
```

If you already accepted writes on the on-prem database, do not restore a Supabase dump over it without a deliberate merge plan. That creates data loss.

## Backups

Backups are mandatory before inviting users.

Minimum policy:

- hourly lightweight health snapshot
- nightly `pg_dump -Fc`
- 7 daily backups
- 4 weekly backups
- 6 monthly backups
- encrypted offsite copy to Cloudflare R2
- monthly restore drill

Create `/usr/local/bin/invariance-pg-backup`:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="/srv/invariance/postgres/backups"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${BACKUP_ROOT}/invariance_research_${TS}.dump"

cd /srv/invariance/postgres
set -a
source .env.postgres
set +a

PGPASSWORD="$INVARIANCE_OWNER_PASSWORD" \
pg_dump \
  --host=127.0.0.1 \
  --port=5432 \
  --username=invariance_owner \
  --dbname=invariance_research \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$OUT"

gzip -9 "$OUT"
find "$BACKUP_ROOT" -name 'invariance_research_*.dump.gz' -mtime +30 -delete

echo "backup_created=${OUT}.gz"
```

Make it executable:

```bash
sudo chmod +x /usr/local/bin/invariance-pg-backup
```

Add cron:

```bash
sudo crontab -e
```

```cron
15 2 * * * /usr/local/bin/invariance-pg-backup >> /srv/invariance/postgres/logs/backup.log 2>&1
```

Offsite copy to R2 can be done with `rclone` or the AWS CLI using R2 credentials. Do not use the same R2 access key that the application uses for user artifacts. Create a dedicated backup key.

## Restore Drill

A backup is not real until restore has been tested.

Monthly:

```bash
createdb invariance_restore_test

PGPASSWORD="$INVARIANCE_OWNER_PASSWORD" \
pg_restore \
  --host=127.0.0.1 \
  --port=5432 \
  --username=invariance_owner \
  --dbname=invariance_restore_test \
  --no-owner \
  --no-acl \
  /srv/invariance/postgres/backups/LATEST_BACKUP.dump
```

Then verify core tables:

```bash
psql -h 127.0.0.1 -U invariance_owner -d invariance_restore_test -c "\dt"
```

Drop restore test database after verification:

```bash
dropdb invariance_restore_test
```

## Monitoring

Minimum checks:

```bash
docker ps
docker logs --tail=100 invariance-postgres
docker logs --tail=100 invariance-pgbouncer
df -h /srv/invariance/postgres
free -h
```

Database connection count:

```sql
SELECT state, count(*)
FROM pg_stat_activity
GROUP BY state
ORDER BY count(*) DESC;
```

Slow queries:

```sql
SELECT now(), datname, usename, state, wait_event_type, wait_event, query
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY query_start ASC;
```

Database size:

```sql
SELECT pg_size_pretty(pg_database_size('invariance_research'));
```

Table sizes:

```sql
SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;
```

PgBouncer health:

```bash
PGPASSWORD="$INVARIANCE_APP_PASSWORD" \
psql -h 127.0.0.1 -p 6432 -U invariance_app -d invariance_research -c 'SELECT 1;'
```

If PgBouncer supports admin console in your configured image:

```bash
psql -h 127.0.0.1 -p 6432 -U postgres pgbouncer -c 'SHOW POOLS;'
psql -h 127.0.0.1 -p 6432 -U postgres pgbouncer -c 'SHOW CLIENTS;'
```

## Security Checklist

Before first user:

- [ ] Direct Postgres `5432` is not open to the public internet.
- [ ] Runtime traffic uses PgBouncer `6432`.
- [ ] TLS is enabled.
- [ ] Database passwords are random 32+ characters.
- [ ] Vercel uses no quotes around env values.
- [ ] Vercel uses `POSTGRES_POOL_MAX=1`.
- [ ] Runtime role is not `postgres`.
- [ ] Schema init/migration role is not used by normal runtime.
- [ ] `POSTGRES_SCHEMA_AUTO_INIT=false` in Vercel and workers.
- [ ] R2 backup key is separate from app artifact key.
- [ ] Backups are encrypted or stored in a private bucket.
- [ ] Restore drill has succeeded.
- [ ] Worker `.env.worker` does not contain old Supabase URLs.
- [ ] Vercel production env does not contain old Supabase URLs.
- [ ] `AUTH_URL`, `NEXTAUTH_URL`, and `APP_URL` still point to `https://invarianceresearch.xyz`.
- [ ] Stripe webhook endpoint still works after cutover.
- [ ] Preview gate still works after cutover.

## Worker VM Update

On the worker VM:

```bash
cd /srv/invariance/invariance_research
docker compose -f deploy/docker-compose.worker.yml down
```

Edit `deploy/.env.worker`:

```env
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://invariance_worker:URL_ENCODED_WORKER_PASSWORD@db.invarianceresearch.xyz:6432/invariance_research?sslmode=require&uselibpqcompat=true
POSTGRES_SCHEMA_AUTO_INIT=false
POSTGRES_POOL_MAX=2
```

Rebuild:

```bash
git pull

INVARIANCE_STACK_ROOT=/srv/invariance \
docker compose -f deploy/docker-compose.worker.yml up -d --build analysis-worker export-worker experiment-worker execution-worker
```

Check:

```bash
docker compose -f deploy/docker-compose.worker.yml ps
docker logs --tail=100 invariance-analysis-worker
docker logs --tail=100 invariance-export-worker
docker logs --tail=100 invariance-experiment-worker
docker logs --tail=100 invariance-execution-worker
```

Expected:

- no password authentication errors
- no `ECIRCUITBREAKER`
- no `SQLite getDb() was called while DATABASE_PROVIDER=postgres`
- worker health checks eventually healthy

## Vercel Environment Variables

Replace Supabase-specific values with:

```env
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://invariance_app:URL_ENCODED_APP_PASSWORD@db.invarianceresearch.xyz:6432/invariance_research?sslmode=require&uselibpqcompat=true
POSTGRES_SCHEMA_AUTO_INIT=false
POSTGRES_POOL_MAX=1
POSTGRES_IDLE_TIMEOUT_MS=10000
POSTGRES_CONNECTION_TIMEOUT_MS=5000
```

Keep these unchanged unless rotating them:

```env
APP_URL=https://invarianceresearch.xyz
NEXTAUTH_URL=https://invarianceresearch.xyz
AUTH_URL=https://invarianceresearch.xyz
AUTH_SECRET=...
NEXTAUTH_SECRET=...
PREVIEW_GATE_PASSWORD=...
OBJECT_STORAGE_PROVIDER=r2
OBJECT_STORAGE_BUCKET=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

After editing Vercel env vars, redeploy. Environment changes do not affect already-running serverless deployments until a new deployment is created.

## Smoke Test Plan

After cutover:

1. Visit the preview-gated site.
2. Enter preview password.
3. Sign in with Google.
4. Open Account.
5. Open Admin Ops.
6. Confirm Admin Health database and queue checks are healthy.
7. Create a small Research Desk program.
8. Queue one tiny experiment or upload one test artifact.
9. Confirm worker picks up the job.
10. Generate an export.
11. Confirm export job completes and artifact appears in R2.
12. Confirm Stripe billing page can load.
13. Confirm Stripe webhook replay table exists and no webhook errors appear.

## Rollback Plan

Rollback is only clean if no production writes have been accepted on the new database.

Before cutover:

- pause platform
- stop workers
- take Supabase final dump
- restore to on-prem
- cut over Vercel and workers

If cutover fails before unpausing:

1. Set Vercel `DATABASE_URL` back to Supabase.
2. Redeploy Vercel.
3. Put old Supabase URL back into `deploy/.env.worker`.
4. Restart workers.
5. Investigate on-prem failure.

If users or workers have already written to on-prem, do not blindly roll back to Supabase. You will split the product's source of truth. Either keep on-prem and fix forward, or plan a deliberate data merge.

## Common Failure Modes

### `password authentication failed`

Cause:

- wrong password
- password not URL-encoded
- wrong role in URL
- copied quoted env value into Vercel
- old deployment still running with old env

Fix:

- verify `DATABASE_URL` hash/host/user via debug endpoint if enabled
- URL-encode password
- redeploy Vercel
- restart workers

### `getaddrinfo ENOTFOUND`

Cause:

- hostname typo
- pasted placeholder text into `DATABASE_URL`
- DNS record not created or propagated

Fix:

```bash
dig db.invarianceresearch.xyz
nc -vz db.invarianceresearch.xyz 6432
```

### `connection timeout`

Cause:

- firewall blocking Vercel or worker VM
- PgBouncer not published
- database VM down
- TLS handshake failing

Fix:

```bash
sudo ufw status verbose
docker ps
docker logs --tail=100 invariance-pgbouncer
```

### `SQLite getDb() was called while DATABASE_PROVIDER=postgres`

Cause:

- a server route still uses a SQLite-only repository
- worker image not rebuilt after a fix
- production has mixed old and new deployments

Fix:

- deploy latest Vercel build
- rebuild workers with `--build`
- search code for direct `getDb()` usage in production paths

### `remaining connection slots are reserved`

Cause:

- too many direct connections
- Vercel not using PgBouncer
- `POSTGRES_POOL_MAX` too high

Fix:

- Vercel `POSTGRES_POOL_MAX=1`
- Vercel URL points to `:6432`
- workers use small pool
- inspect `pg_stat_activity`

## Implementation Phases

### P0 - Design Freeze And Inventory

Owner: `invariance_research`

- Confirm all production code uses repository/provider contracts, not SQLite direct access.
- Confirm Vercel and workers use the same database contract.
- Record current Supabase database size and table count.
- Record current Vercel env values without exposing secrets.
- Record current worker `.env.worker` values without exposing secrets.
- Decide whether the database VM is dedicated or shared with workers for the first rollout.

### P1 - VM Provisioning

Owner: infrastructure

- Provision Ubuntu/Debian VM.
- Attach SSD/NVMe volume.
- Create `/srv/invariance/postgres` layout.
- Install Docker.
- Configure UFW and fail2ban.
- Configure DNS for `db.invarianceresearch.xyz`.
- Issue TLS certificate.

### P2 - Postgres And PgBouncer Bootstrap

Owner: infrastructure

- Create `.env.postgres`.
- Create Postgres config.
- Create bootstrap SQL.
- Start Postgres and PgBouncer.
- Verify local direct Postgres connection.
- Verify local PgBouncer connection.
- Verify remote worker VM connection.
- Verify Vercel can connect if static egress/public endpoint is configured.

### P3 - Product Schema Initialization

Owner: `invariance_research`

- Run `npm run db:init:postgres` once with the owner URL.
- Confirm expected tables exist.
- Confirm runtime role can read/write expected tables.
- Confirm `POSTGRES_SCHEMA_AUTO_INIT=false` remains in Vercel and worker runtime.

### P4 - Supabase Data Migration

Owner: infrastructure plus `invariance_research`

- Pause platform and queues.
- Stop workers.
- Dump Supabase.
- Restore into on-prem.
- Run schema init again to apply current schema additions.
- Run smoke queries.
- Keep Supabase read-only as rollback source until cutover is accepted.

### P5 - Runtime Cutover

Owner: infrastructure

- Update Vercel `DATABASE_URL`.
- Redeploy Vercel.
- Update worker `.env.worker`.
- Rebuild/restart workers.
- Confirm Admin Health.
- Confirm auth, account, admin, Research Desk, queue, export, Stripe, and object-storage flows.

### P6 - Backup And Restore Hardening

Owner: infrastructure

- Install nightly backup job.
- Configure offsite R2 copy.
- Run first backup.
- Run restore drill.
- Document restore time and backup size.
- Add backup health to Admin Ops or an external monitor.

### P7 - Production Hardening

Owner: infrastructure plus `invariance_research`

- Add query/connection monitoring.
- Add disk alerts.
- Add backup failure alerts.
- Add certificate expiry alerts.
- Review slow query logs.
- Confirm PgBouncer pool sizing after real traffic.
- Rotate Supabase credentials or remove Supabase access from production env.

### P8 - Scale Path

Owner: infrastructure

- Move Postgres to a dedicated VM if it started shared.
- Add streaming replica for backup/analytics.
- Add point-in-time recovery with WAL archiving.
- Add private networking or static Vercel egress.
- Add periodic load tests for queue-heavy experiment runs.

## Launch Readiness Definition

On-prem Postgres is production-ready when:

- Vercel and all workers connect to on-prem Postgres, not Supabase.
- Runtime uses PgBouncer or another deliberate pooler.
- `POSTGRES_SCHEMA_AUTO_INIT=false` in runtime.
- Explicit schema init has succeeded.
- Backups run automatically.
- A restore drill has succeeded.
- Database is reachable only through the intended network path.
- Admin Health is clean.
- A full smoke test completes: sign-in, create program, queue experiment, worker processing, export, and admin audit.
