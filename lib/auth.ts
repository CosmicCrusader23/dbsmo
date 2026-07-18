import { NextAuthOptions, DefaultSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import type { Adapter } from "next-auth/adapters";
import { UserRole } from "@prisma/client";
import {
  DEFAULT_SCHOOL_EMAIL_DOMAINS,
  isAllowedSchoolEmail,
  isDevBypassEnabled,
  parseSchoolEmailDomains,
  resolveSessionAuthority,
} from "@/lib/auth-policy";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      group: string | null;
    } & DefaultSession["user"];
  }
}

export const SCHOOL_EMAIL_DOMAINS = parseSchoolEmailDomains(process.env.SCHOOL_EMAIL_DOMAINS);
export const ALLOWED_EMAIL_DOMAINS = SCHOOL_EMAIL_DOMAINS.map((domain) => `@${domain}`);
export const ALLOWED_EMAILS = ["edwinchansjps@gmail.com"];
export const SCHOOL_EMAIL_SUFFIX =
  ALLOWED_EMAIL_DOMAINS[0] ?? `@${DEFAULT_SCHOOL_EMAIL_DOMAINS[0]}`;
export const devBypassEnabled = isDevBypassEnabled(
  process.env.NODE_ENV,
  process.env.AUTH_DEV_BYPASS,
);
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
        role: { label: "Role", type: "text", placeholder: "STUDENT" },
      },
      async authorize(credentials) {
        const requestedRole = String(credentials?.role ?? "STUDENT").toUpperCase();
        const validRoles: UserRole[] = ["STUDENT", "TEACHER", "CONTENT_EDITOR", "ANALYST", "ADMIN"];
        const role = validRoles.includes(requestedRole as UserRole)
          ? (requestedRole as UserRole)
          : "STUDENT";
        const id =
          role === "STUDENT" ? "bypass-student" : `bypass-${role.toLowerCase().replace(/_/g, "-")}`;

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

      if (!isAllowedSchoolEmail(user.email, SCHOOL_EMAIL_DOMAINS, ALLOWED_EMAILS)) {
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
      if (!session.user) return session;

      const tokenId = typeof token.id === "string" ? token.id : null;
      const dbUser = tokenId
        ? await prisma.user.findUnique({
            where: { id: tokenId },
            select: { role: true, group: true, image: true },
          })
        : null;
      const authority = resolveSessionAuthority(tokenId, dbUser);

      if (!authority) {
        delete token.id;
        delete token.role;
        // NextAuth's v4 callback type excludes null, but its session endpoint
        // accepts a null callback result and exposes it as unauthenticated.
        return null as unknown as typeof session;
      }

      session.user.id = authority.id;
      session.user.role = authority.role;
      session.user.group = authority.group;
      session.user.image = authority.image ?? session.user.image ?? null;
      return session;
    },
  },
};
