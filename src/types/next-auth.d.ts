import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      account_id: string;
    };
  }

  interface User {
    account_id?: string;
    session_version?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    account_id?: string;
    session_version?: number;
    invalidated?: boolean;
  }
}
