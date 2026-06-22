import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getBoss } from "@/lib/playground/bosses";
import { BossBattle } from "./battle";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export default async function PlaygroundBossPage({ params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/");
  const { slug } = await params;
  const boss = getBoss(slug);
  if (!boss) notFound();
  return (
    <main className="playground-shell">
      <BossBattle boss={boss} userId={session.user.id} />
    </main>
  );
}

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const boss = getBoss(slug);
  return {
    title: boss ? `${boss.name} · Playground · DBSMO` : "Playground · DBSMO",
  };
}
