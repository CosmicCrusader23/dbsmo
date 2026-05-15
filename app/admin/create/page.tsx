import { CreateSetPageClient } from "./page-client";

type CreateSetPageProps = {
  searchParams?: Promise<{
    importDraft?: string;
  }>;
};

export default async function CreateSetPage({ searchParams }: CreateSetPageProps) {
  const resolvedSearchParams = await searchParams;

  return <CreateSetPageClient importDraftKey={resolvedSearchParams?.importDraft ?? null} />;
}
