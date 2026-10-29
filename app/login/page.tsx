import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/safe-redirect";

type LoginPageProps = {
  searchParams: Promise<{ redirect?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getServerSession(authOptions);
  const query = await searchParams;
  const callbackUrl = safeRedirectPath(query.redirect);

  if (session) {
    redirect(callbackUrl);
  }

  redirect(`/?redirect=${encodeURIComponent(callbackUrl)}`);
}
