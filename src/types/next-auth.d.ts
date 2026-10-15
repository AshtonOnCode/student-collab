import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: number;
    } & DefaultSession["user"];
  }

  interface User {
    id?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: number;
  }
}
