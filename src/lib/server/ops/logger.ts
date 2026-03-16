export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

function write(level: LogLevel, message: string, fields: LogFields = {}) {
  const payload = { ts: new Date().toISOString(), level, message, ...fields };
  if (level === "error") return console.error(JSON.stringify(payload));
  console.log(JSON.stringify(payload));
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write("debug", message, fields),
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};
