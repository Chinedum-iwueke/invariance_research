export const PREVIEW_GATE_COOKIE_NAME = "ir_preview_access";

const DEFAULT_COOKIE_SECRET = "invariance-preview-gate";

function normalized(value: string | undefined) {
  return value?.trim() ?? "";
}

export function getPreviewGatePassword() {
  return normalized(process.env.PREVIEW_GATE_PASSWORD);
}

export function previewGateEnabled() {
  const configured = getPreviewGatePassword().length > 0;
  const disabled = normalized(process.env.PREVIEW_GATE_ENABLED).toLowerCase() === "false";
  return configured && !disabled;
}

export function getPreviewGateCookieSecret() {
  return normalized(process.env.PREVIEW_GATE_COOKIE_SECRET)
    || normalized(process.env.AUTH_SECRET)
    || normalized(process.env.NEXTAUTH_SECRET)
    || DEFAULT_COOKIE_SECRET;
}

export async function createPreviewGateToken(password = getPreviewGatePassword()) {
  const input = `${password}:${getPreviewGateCookieSecret()}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

