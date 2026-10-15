import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { prisma } from "../../lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [Google, GitHub],

  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = Number(user.id); // number if your User.id is Int
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as number;
      return session;
    },
  },
});
