import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { FtwMatchClient } from "./match-client";

export const dynamic = "force-dynamic";

export default async function FtwMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/");

  const { id } = await params;
  const match = await prisma.ftwMatch.findUnique({ where: { id } });
  if (!match || match.userId !== session.user.id) notFound();

  return (
    <main className="ftw-shell">
      <div className="ftw-page">
        <FtwMatchClient
          matchId={match.id}
          tag={match.tag}
          totalProblems={match.totalProblems}
          maxScore={match.maxScore}
          initialStatus={match.status}
        />
      </div>
    </main>
  );
}
