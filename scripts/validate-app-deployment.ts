import fs from "node:fs";
import path from "node:path";
import { validateAppDeploymentConfig } from "../src/lib/server/ops/app-deployment-config";

function parseEnvFile(source: string) {
  const env: Record<string, string | undefined> = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function argumentValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const envFile = argumentValue("--env-file");
if (!envFile) {
  console.error("Usage: npm run deploy:validate-app -- --env-file /etc/invariance/app/app.env");
  process.exitCode = 2;
} else {
  const absolutePath = path.resolve(envFile);
  const stat = fs.statSync(absolutePath);
  const mode = stat.mode & 0o777;
  const env = parseEnvFile(fs.readFileSync(absolutePath, "utf8"));
  const validation = validateAppDeploymentConfig(env);

  if ((mode & 0o077) !== 0) {
    validation.issues.push({
      level: "error",
      code: "unsafe_env_file_permissions",
      message: `Runtime env file permissions are ${mode.toString(8)}; expected 600 or stricter.`,
    });
    validation.ok = false;
  }

  for (const issue of validation.issues) {
    const target = issue.variable ? ` [${issue.variable}]` : "";
    const output = `${issue.level.toUpperCase()} ${issue.code}${target}: ${issue.message}`;
    if (issue.level === "error") console.error(output);
    else console.warn(output);
  }

  if (validation.ok) {
    console.log(`Application deployment configuration is valid (${absolutePath}).`);
  } else {
    console.error(`Application deployment configuration is not ready (${absolutePath}).`);
    process.exitCode = 1;
  }
}
