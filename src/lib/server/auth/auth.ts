import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { accountService } from "@/lib/server/accounts/service";
import { logger } from "@/lib/server/ops/logger";

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

export async function provisionGoogleOAuthUser(input: { email?: string | null; name?: string | null }) {
  const email = input.email?.trim().toLowerCase();
  if (!email) {
    throw new Error("oauth_email_required");
  }

  logger.info("oauth.user.received", { provider: "google", email });
  const provisioned = await accountService.ensureUserAndAccount({ email, name: input.name ?? undefined });
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

        const authenticated = await accountService.authenticateWithPassword({ email, password });
        if (!authenticated) return null;

        return {
          id: authenticated.user.user_id,
          email: authenticated.user.email,
          name: authenticated.user.name,
          account_id: authenticated.account.account_id,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;

      try {
        const provisioned = await provisionGoogleOAuthUser({ email: user.email, name: user.name });
        user.id = provisioned.user.user_id;
        user.email = provisioned.user.email;
        user.name = provisioned.user.name ?? user.name;
        user.account_id = provisioned.account.account_id;
        return true;
      } catch (error) {
        logger.error("oauth.user.provision_failed", {
          provider: "google",
          email: user.email,
          error: error instanceof Error ? error.message : "unknown_error",
        });
        return "/login?error=OAuthProvisioning";
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.account_id = user.account_id;
      } else if (token.sub && !token.account_id) {
        const repaired = await accountService.ensureAccountForUserId(String(token.sub));
        if (repaired) {
          token.email = repaired.user.email;
          token.account_id = repaired.account.account_id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub && token.account_id) {
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
