import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { accountService } from "@/lib/server/accounts/service";

export const authConfig = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toString().trim().toLowerCase();
        if (!email) return null;
        const name = credentials?.name?.toString().trim() || undefined;
        const { user, account } = accountService.ensureUserAndAccount({ email, name });
        accountService.recordLogin(user.user_id);
        return { id: user.user_id, email: user.email, name: user.name, account_id: account.account_id };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.account_id = user.account_id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub && token.account_id) {
        session.user.id = token.sub;
        session.user.account_id = token.account_id;
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
