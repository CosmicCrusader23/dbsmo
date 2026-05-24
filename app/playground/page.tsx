import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { BOSSES } from "@/lib/playground/bosses";
import { PlaygroundHub } from "./hub";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Playground · DBSMO",
};

export default async function PlaygroundPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  return <PlaygroundHub bosses={BOSSES} />;
}
