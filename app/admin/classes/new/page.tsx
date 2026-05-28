import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NewClassForm } from "./new-class-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "New class · DBSMO" };

export default async function NewClassPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role, "admin:users")) redirect("/dashboard");
  return <NewClassForm />;
}
