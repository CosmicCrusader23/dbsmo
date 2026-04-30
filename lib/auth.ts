import { NextAuthOptions, DefaultSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import type { Adapter } from "next-auth/adapters";
import { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      group: string | null;
    } & DefaultSession["user"];
  }
}

export const ALLOWED_EMAIL_DOMAINS = ["@g.dbs.edu.hk", "@dbs.edu.hk"];
export const SCHOOL_EMAIL_SUFFIX = ALLOWED_EMAIL_DOMAINS[0]; // fallback for dev bypass
export const devBypassEnabled = process.env.NODE_ENV !== "production";
export const googleAuthEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

const providers: NonNullable<NextAuthOptions["providers"]> = [];

if (googleAuthEnabled) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  );
}

if (devBypassEnabled) {
  providers.push(
    CredentialsProvider({
      name: "Developer Bypass",
      credentials: {
        role: { label: "Role (STUDENT or ADMIN)", type: "text", placeholder: "STUDENT" },
      },
      async authorize(credentials) {
        const role = credentials?.role === "ADMIN" ? "ADMIN" : "STUDENT";
        const id = role === "ADMIN" ? "bypass-admin" : "bypass-student";

        const user = await prisma.user.upsert({
          where: { email: `${id}${SCHOOL_EMAIL_SUFFIX}` },
          update: {
            group: role === "STUDENT" ? "MO" : null,
            lastLoginAt: new Date(),
            role: role as UserRole,
          },
          create: {
            id,
            email: `${id}${SCHOOL_EMAIL_SUFFIX}`,
            group: role === "STUDENT" ? "MO" : null,
            lastLoginAt: new Date(),
            name: `Test ${role}`,
            role: role as UserRole,
          },
        });

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
  },
  providers,
  callbacks: {
    async signIn({ account, user }) {
      if (account?.provider === "credentials") {
        return devBypassEnabled;
      }

      const email = user.email?.toLowerCase();
      if (!email || !ALLOWED_EMAIL_DOMAINS.some(domain => email.endsWith(domain))) {
        return false;
      }

      if (user.id) {
        await prisma.user
          .update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })
          .catch(() => null);
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const nextRole = "role" in user ? user.role : undefined;
        token.role = (nextRole as UserRole | undefined) ?? "STUDENT";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;

        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, group: true },
        });

        if (dbUser) {
          session.user.role = dbUser.role;
          session.user.group = dbUser.group;
        } else {
          session.user.role = (token.role as UserRole) ?? "STUDENT";
          session.user.group = null;
        }
      }
      return session;
    },
  },
};
