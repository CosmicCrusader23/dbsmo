import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { ClassDetailClient } from "./class-detail-client";

export const dynamic = "force-dynamic";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role, "admin:users")) redirect("/dashboard");
  const { id } = await params;
  const cls = await prisma.class.findUnique({ where: { id }, select: { id: true, teacherId: true } });
  if (!cls) notFound();
  if (user.role !== "ADMIN" && cls.teacherId !== session.user.id) {
    redirect("/admin/classes");
  }
  return <ClassDetailClient classId={id} />;
}
