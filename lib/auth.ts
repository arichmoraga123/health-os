import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // refresh session age daily
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // keep JWT valid for 30 days
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        token: { label: "Oura Token", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          return null;
        }
        const [user] = credentials.token
          ? await db
              .select()
              .from(users)
              .where(eq(users.email, credentials.email))
              .limit(1)
          : await db
              .select()
              .from(users)
              .where(eq(users.email, credentials.email))
              .limit(1);
        if (credentials.token && user?.ouraToken !== credentials.token) return null;
        if (!user) return null;
        return { id: user.id, email: user.email ?? undefined, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        if (token.email) session.user.email = token.email as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export { ADMIN_EMAILS, isAdminEmail } from "@/lib/admin";
