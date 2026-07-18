import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { CreateSetPageClient } from "./page-client";

type CreateSetPageProps = {
  searchParams?: Promise<{
    importDraft?: string;
  }>;
};

export default async function CreateSetPage({ searchParams }: CreateSetPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  if (!hasPermission(session.user.role, "admin:content")) redirect("/dashboard");

  const resolvedSearchParams = await searchParams;

  return <CreateSetPageClient importDraftKey={resolvedSearchParams?.importDraft ?? null} />;
}
