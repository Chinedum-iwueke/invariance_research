import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { accountService } from "@/lib/server/accounts/service";
import { logger } from "@/lib/server/ops/logger";
import { checkRateLimit } from "@/lib/server/rate-limits";

export const requiredAuthEnvVars = [
  "NEXTAUTH_URL",
  "APP_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

export function getMissingAuthEnvVars(env: NodeJS.ProcessEnv = process.env) {
  const missing: string[] = requiredAuthEnvVars.filter((key) => !env[key]);
  if (!env.NEXTAUTH_SECRET && !env.AUTH_SECRET) {
    missing.push("NEXTAUTH_SECRET/AUTH_SECRET");
  }
  return missing;
}

export async function provisionGoogleOAuthUser(input: { email?: string | null; name?: string | null; emailVerified?: boolean }) {
  const email = input.email?.trim().toLowerCase();
  if (!email) {
    throw new Error("oauth_email_required");
  }

  logger.info("oauth.user.received", { provider: "google", email });
  const provisioned = await accountService.ensureUserAndAccount({ email, name: input.name ?? undefined, emailVerified: Boolean(input.emailVerified) });
  await accountService.recordLogin(provisioned.user.user_id);
  logger.info("oauth.user.linked", { provider: "google", user_id: provisioned.user.user_id, email: provisioned.user.email });
  logger.info("account.provisioned", { provider: "google", user_id: provisioned.user.user_id, account_id: provisioned.account.account_id });
  return provisioned;
}

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toString().trim().toLowerCase();
        const password = credentials?.password?.toString() ?? "";
        if (!email || !password) return null;
        const limited = await checkRateLimit({ route: "login", kind: "auth", key: `email:${email}` });
        if (!limited.allowed) return null;

        const authenticated = await accountService.authenticateWithPassword({ email, password });
        if (!authenticated) return null;

        return {
          id: authenticated.user.user_id,
          email: authenticated.user.email,
          name: authenticated.user.name,
          account_id: authenticated.account.account_id,
          session_version: authenticated.user.session_version ?? 0,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;

      try {
        if (user.email) {
          const limited = await checkRateLimit({ route: "google_oauth", kind: "auth", key: `email:${user.email.toLowerCase()}` });
          if (!limited.allowed) return "/login?error=RateLimited";
        }
        const provisioned = await provisionGoogleOAuthUser({
          email: user.email,
          name: user.name,
          emailVerified: (profile as { email_verified?: boolean } | undefined)?.email_verified === true,
        });
        user.id = provisioned.user.user_id;
        user.email = provisioned.user.email;
        user.name = provisioned.user.name ?? user.name;
        user.account_id = provisioned.account.account_id;
        user.session_version = provisioned.user.session_version ?? 0;
        return true;
      } catch (error) {
        const errorDetails = error instanceof Error ? {
          message: error.message,
          code: (error as any).code,
          errno: (error as any).errno,
          syscall: (error as any).syscall,
          stack: error.stack,
          fullError: error.toString(),
        } : {
          type: typeof error,
          value: error,
        };
        logger.error("oauth.user.provision_failed", {
          provider: "google",
          email: user.email,
          ...errorDetails,
        });
        return "/login?error=OAuthProvisioning";
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.account_id = user.account_id;
        token.session_version = user.session_version ?? 0;
      } else if (token.sub && !token.account_id) {
        const repaired = await accountService.ensureAccountForUserId(String(token.sub));
        if (repaired) {
          token.email = repaired.user.email;
          token.account_id = repaired.account.account_id;
          token.session_version = repaired.user.session_version ?? 0;
        }
      } else if (token.sub) {
        const repaired = await accountService.ensureAccountForUserId(String(token.sub));
        if (!repaired || Number(token.session_version ?? 0) !== Number(repaired.user.session_version ?? 0)) {
          token.invalidated = true;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub && token.account_id && !token.invalidated) {
        session.user.id = token.sub;
        session.user.account_id = String(token.account_id);
        logger.info("session.created", { user_id: session.user.id, account_id: session.user.account_id });
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
