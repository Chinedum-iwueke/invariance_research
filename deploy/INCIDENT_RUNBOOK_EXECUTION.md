# Execution Incident Runbook

This runbook applies to Binance and Bybit demo and live-canary deployments. The exchange is authoritative. Never clear an incident merely because the UI looks quiet.

## Immediate response

1. Use **Emergency freeze** on the affected Research Program. This cancels open orders, optionally submits approved reduce-only closes for perpetual positions, disables further mutation, and reconciles exchange state.
2. If the web control is unavailable, pause all execution intake on the worker host and restart only after database and exchange access are known-good:

   ```bash
   INVARIANCE_EXECUTION_QUEUE_PAUSED=true
   docker compose -f deploy/docker-compose.worker.yml up -d --force-recreate execution-worker
   ```

3. Inspect the exchange directly. Record open orders, positions, balances, recent fills, and the exchange timestamp. Do not submit compensating orders until the reconciled position is understood.
4. Inspect `deployment_incidents`, `deployment_events`, `deployment_projections`, `connector_stream_sessions`, and `connector_credential_use_audit` for the affected deployment.

## Incident classes

### Connector or private-stream failure

- Leave the deployment frozen.
- Confirm REST authentication, private-stream authentication, server-time tolerance, product type, and demo/live endpoint identity.
- Rotate credentials if authentication is uncertain. Use a new write-only connector secret with read/trade permission and no withdrawal permission.
- Run connector diagnosis, then reconcile. A REST-only success is not sufficient for live canary.

### Reconciliation divergence

- Treat exchange orders, fills, positions, and balances as authoritative.
- Preserve the divergent projection and event IDs for investigation.
- Reconcile twice, separated by one polling interval. If the snapshots disagree again, keep the deployment frozen and open a critical incident.

### Risk-limit or memory-policy block

- Do not override the order manually.
- Review the immutable policy hash, projection hash, reason codes, assessment support, drift, calibration, and source episodes.
- A memory assessment may block or reduce risk only under an explicitly approved enforced policy. It may never increase quantity.
- Resolve the evaluation outcome later as positive, negative, or neutral so false-block and missed-risk rates remain measurable.

### Credential exposure

- Freeze every deployment using the connector.
- Revoke the exchange key, create a replacement with withdrawals disabled and IP restrictions, then rotate the stored credential.
- Rotate `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY` only through a planned re-encryption procedure; changing it in place makes existing connector envelopes unreadable.

## Recovery gate

Recovery requires all of the following:

- no unresolved critical incident;
- healthy REST and authenticated private stream;
- exchange-authoritative reconciliation with no divergence;
- no open orders left from the incident;
- approved safety policy still matches intended symbols and limits;
- emergency freeze/recovery drill passes;
- for live canary, the original demo qualification and promotion evidence remain valid.

Resume through the product control only. The action is audit logged. If any check fails, remain read-only.

## External alert verification

Critical incidents are delivered to `EXECUTION_INCIDENT_WEBHOOK_URL`. Verify:

```text
HMAC_SHA256(EXECUTION_INCIDENT_WEBHOOK_SECRET, raw_request_body)
```

against the hexadecimal digest in `x-invariance-signature: sha256=<digest>`. Deduplicate on `x-invariance-delivery`. Alert payloads contain incident metadata, never exchange credentials.
