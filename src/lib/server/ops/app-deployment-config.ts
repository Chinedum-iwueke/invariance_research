export type DeploymentConfigIssue = {
  level: "error" | "warning";
  code: string;
  variable?: string;
  message: string;
};

export type DeploymentConfigValidation = {
  ok: boolean;
  issues: DeploymentConfigIssue[];
};

export type DeploymentEnvironment = Record<string, string | undefined>;

const REQUIRED_VALUES = [
  "APP_URL",
  "AUTH_URL",
  "NEXTAUTH_URL",
  "AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "DATABASE_URL",
  "OBJECT_STORAGE_BUCKET",
  "OBJECT_STORAGE_ENDPOINT",
  "OBJECT_STORAGE_ACCESS_KEY_ID",
  "OBJECT_STORAGE_SECRET_ACCESS_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_EXPLORER",
  "STRIPE_PRICE_PRO",
  "EMAIL_FROM",
  "RESEND_API_KEY",
  "LLM_CREDENTIAL_ENCRYPTION_KEY",
  "EXCHANGE_CREDENTIAL_ENCRYPTION_KEY",
] as const;

function normalized(value: string | undefined) {
  return value?.trim() ?? "";
}

function enabled(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(normalized(value).toLowerCase());
}

function placeholder(value: string) {
  return /(?:replace|example|your[-_]|changeme|set_me|account_id|password|secret|price_replace|sk_live_replace|whsec_replace)/i.test(value);
}

function addIssue(
  issues: DeploymentConfigIssue[],
  level: DeploymentConfigIssue["level"],
  code: string,
  message: string,
  variable?: string,
) {
  issues.push({ level, code, variable, message });
}

export function validateAppDeploymentConfig(env: DeploymentEnvironment): DeploymentConfigValidation {
  const issues: DeploymentConfigIssue[] = [];

  const deploymentStage = normalized(env.APP_DEPLOYMENT_STAGE).toLowerCase();
  if (deploymentStage !== "preview" && deploymentStage !== "production") {
    addIssue(
      issues,
      "error",
      "deployment_stage_invalid",
      "APP_DEPLOYMENT_STAGE must be preview or production.",
      "APP_DEPLOYMENT_STAGE",
    );
  }

  for (const variable of REQUIRED_VALUES) {
    const value = normalized(env[variable]);
    if (!value) {
      addIssue(issues, "error", "required_value_missing", `${variable} is required.`, variable);
    } else if (placeholder(value)) {
      addIssue(issues, "error", "placeholder_value", `${variable} still contains a placeholder.`, variable);
    }
  }

  const urls = ["APP_URL", "AUTH_URL", "NEXTAUTH_URL"] as const;
  const parsedUrls = urls.map((variable) => {
    const raw = normalized(env[variable]);
    if (!raw) return undefined;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "https:" || parsed.pathname !== "/" || parsed.search || parsed.hash) {
        addIssue(issues, "error", "canonical_url_invalid", `${variable} must be an HTTPS origin without a path, query, or fragment.`, variable);
      }
      return parsed.origin;
    } catch {
      addIssue(issues, "error", "canonical_url_invalid", `${variable} is not a valid URL.`, variable);
      return undefined;
    }
  });
  const distinctOrigins = new Set(parsedUrls.filter(Boolean));
  if (distinctOrigins.size > 1) {
    addIssue(issues, "error", "canonical_url_mismatch", "APP_URL, AUTH_URL, and NEXTAUTH_URL must be identical.");
  }

  const authSecret = normalized(env.AUTH_SECRET || env.NEXTAUTH_SECRET);
  if (authSecret && authSecret.length < 32) {
    addIssue(issues, "error", "auth_secret_too_short", "AUTH_SECRET must contain at least 32 characters.", "AUTH_SECRET");
  }
  if (env.AUTH_SECRET && env.NEXTAUTH_SECRET && env.AUTH_SECRET !== env.NEXTAUTH_SECRET) {
    addIssue(issues, "error", "auth_secret_mismatch", "AUTH_SECRET and NEXTAUTH_SECRET must match during the compatibility period.");
  }

  if (normalized(env.DATABASE_PROVIDER).toLowerCase() !== "postgres") {
    addIssue(issues, "error", "database_provider_invalid", "Production web runtime must use DATABASE_PROVIDER=postgres.", "DATABASE_PROVIDER");
  }
  const databaseUrl = normalized(env.DATABASE_URL);
  if (databaseUrl) {
    try {
      const parsed = new URL(databaseUrl);
      if (!parsed.protocol.startsWith("postgres")) throw new Error("invalid_protocol");
      if (parsed.searchParams.get("sslmode") !== "verify-full") {
        addIssue(issues, "error", "database_tls_not_verified", "DATABASE_URL must use sslmode=verify-full.", "DATABASE_URL");
      }
      if (!parsed.password) addIssue(issues, "error", "database_password_missing", "DATABASE_URL must include the app role password.", "DATABASE_URL");
      if (["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname)) {
        addIssue(issues, "error", "database_host_invalid", "The web container must use the private PgBouncer service hostname.", "DATABASE_URL");
      }
    } catch {
      addIssue(issues, "error", "database_url_invalid", "DATABASE_URL is not a valid Postgres URL.", "DATABASE_URL");
    }
  }
  if (normalized(env.POSTGRES_SCHEMA_AUTO_INIT).toLowerCase() !== "false") {
    addIssue(issues, "error", "schema_auto_init_enabled", "POSTGRES_SCHEMA_AUTO_INIT must be false for long-running web containers.", "POSTGRES_SCHEMA_AUTO_INIT");
  }
  const poolMax = Number.parseInt(normalized(env.POSTGRES_POOL_MAX), 10);
  if (!Number.isFinite(poolMax) || poolMax < 1 || poolMax > 5) {
    addIssue(issues, "error", "postgres_pool_out_of_range", "POSTGRES_POOL_MAX must be between 1 and 5 per web replica.", "POSTGRES_POOL_MAX");
  }
  if (normalized(env.NODE_EXTRA_CA_CERTS) !== "/etc/invariance/db-ca.crt") {
    addIssue(issues, "error", "database_ca_path_invalid", "NODE_EXTRA_CA_CERTS must point to the read-only database CA mount.", "NODE_EXTRA_CA_CERTS");
  }

  if (normalized(env.WORKER_MODE).toLowerCase() !== "external") {
    addIssue(issues, "error", "worker_mode_invalid", "Production web runtime must use WORKER_MODE=external.", "WORKER_MODE");
  }
  if (enabled(env.ALLOW_EMBEDDED_WORKERS) || enabled(env.INVARIANCE_EMBEDDED_WORKERS)) {
    addIssue(issues, "error", "embedded_workers_enabled", "Embedded workers must be disabled in the web runtime.");
  }

  const storageProvider = normalized(env.OBJECT_STORAGE_PROVIDER).toLowerCase();
  if (storageProvider !== "r2" && storageProvider !== "s3") {
    addIssue(issues, "error", "object_storage_provider_invalid", "Production object storage must use R2 or S3.", "OBJECT_STORAGE_PROVIDER");
  }

  if (normalized(env.EMAIL_PROVIDER).toLowerCase() !== "resend") {
    addIssue(issues, "error", "email_provider_invalid", "Production email must use the configured Resend provider.", "EMAIL_PROVIDER");
  }
  const stripeSecret = normalized(env.STRIPE_SECRET_KEY);
  if (deploymentStage === "production" && !stripeSecret.startsWith("sk_live_")) {
    addIssue(issues, "error", "stripe_not_live", "Production requires a live-mode STRIPE_SECRET_KEY.", "STRIPE_SECRET_KEY");
  }
  if (deploymentStage === "preview" && !stripeSecret.startsWith("sk_test_")) {
    addIssue(issues, "error", "stripe_not_test", "Preview requires a test-mode STRIPE_SECRET_KEY.", "STRIPE_SECRET_KEY");
  }
  if (!normalized(env.STRIPE_WEBHOOK_SECRET).startsWith("whsec_")) {
    addIssue(issues, "error", "stripe_webhook_secret_invalid", "STRIPE_WEBHOOK_SECRET must be a Stripe signing secret.", "STRIPE_WEBHOOK_SECRET");
  }

  for (const variable of ["LLM_CREDENTIAL_ENCRYPTION_KEY", "EXCHANGE_CREDENTIAL_ENCRYPTION_KEY"] as const) {
    const value = normalized(env[variable]);
    if (value && value.length < 32) {
      addIssue(issues, "error", "encryption_key_too_short", `${variable} must contain at least 32 characters.`, variable);
    }
  }

  if (!enabled(env.RATE_LIMITS_ENABLED)) {
    addIssue(issues, "error", "rate_limits_disabled", "RATE_LIMITS_ENABLED must be true in production.", "RATE_LIMITS_ENABLED");
  }
  if (normalized(env.DEBUG_RUNTIME_ENV_TOKEN)) {
    addIssue(issues, "warning", "debug_route_enabled", "DEBUG_RUNTIME_ENV_TOKEN should be unset outside a time-boxed incident.", "DEBUG_RUNTIME_ENV_TOKEN");
  }
  if (!enabled(env.OBJECT_STORAGE_LIFECYCLE_CONFIGURED)) {
    addIssue(issues, "warning", "storage_lifecycle_unconfirmed", "R2 lifecycle configuration has not been acknowledged.", "OBJECT_STORAGE_LIFECYCLE_CONFIGURED");
  }
  if (enabled(env.LLM_RESEARCH_ASSISTANT_ENABLED) && !normalized(env.OPENAI_API_KEY)) {
    addIssue(issues, "error", "hosted_llm_key_missing", "Hosted assistant inference is enabled without OPENAI_API_KEY.", "OPENAI_API_KEY");
  }

  return {
    ok: issues.every((issue) => issue.level !== "error"),
    issues,
  };
}
