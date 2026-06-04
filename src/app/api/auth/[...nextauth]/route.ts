import { handlers } from "@/lib/server/auth/auth";
import { AuthError } from "@auth/core/errors";
import type { NextRequest } from "next/server";

function authRecoveryUrl(request: Request, code = "OAuthSession") {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", code);
  return url;
}

function isRecoverableOAuthError(error: unknown) {
  if (error instanceof AuthError) {
    return ["InvalidCheck", "OAuthCallbackError", "OAuthSignInError", "CallbackRouteError"].includes(error.type);
  }
  return error instanceof Error && /InvalidCheck|pkceCodeVerifier|OAuth/i.test(error.message);
}

export async function GET(request: NextRequest) {
  try {
    return await handlers.GET(request);
  } catch (error) {
    if (isRecoverableOAuthError(error)) {
      return Response.redirect(authRecoveryUrl(request), 302);
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handlers.POST(request);
  } catch (error) {
    if (isRecoverableOAuthError(error)) {
      return Response.redirect(authRecoveryUrl(request), 302);
    }
    throw error;
  }
}
