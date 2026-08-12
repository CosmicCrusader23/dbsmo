import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { CreateSetPageClient } from "./page-client";
import { firstQueryParam, type QueryParamValue } from "@/lib/query-params";

type CreateSetPageProps = {
  searchParams?: Promise<{
    importDraft?: QueryParamValue;
  }>;
};

export default async function CreateSetPage({ searchParams }: CreateSetPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  if (!hasPermission(session.user.role, "admin:content")) redirect("/dashboard");

  const resolvedSearchParams = await searchParams;

  return (
    <CreateSetPageClient
      importDraftKey={firstQueryParam(resolvedSearchParams?.importDraft) ?? null}
    />
  );
}
