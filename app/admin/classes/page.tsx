import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { Plus, GraduationCap } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Classes · DBSMO" };

export default async function ClassesIndex() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role, "admin:users")) redirect("/dashboard");

  const isAdmin = user.role === "ADMIN";
  const classes = await prisma.class.findMany({
    where: isAdmin ? {} : { teacherId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      teacher: { select: { id: true, displayName: true, name: true, email: true } },
      _count: { select: { members: true, assignments: true } },
    },
  });

  return (
    <main className="classes-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Teaching</p>
          <h1>
            <GraduationCap size={26} /> Classes
          </h1>
        </div>
        <Link href="/admin/classes/new" className="primary-action">
          <Plus size={16} /> New class
        </Link>
      </header>

      {classes.length === 0 ? (
        <div className="classes-empty">
          <p>No classes yet.</p>
          <Link href="/admin/classes/new" className="primary-action">
            <Plus size={16} /> Create your first class
          </Link>
        </div>
      ) : (
        <ul className="classes-grid">
          {classes.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/classes/${c.id}`} className="classes-card">
                <h2>{c.name}</h2>
                <p className="classes-card-meta">
                  <span>{c._count.members} students</span>
                  <span>{c._count.assignments} assignments</span>
                </p>
                {isAdmin ? (
                  <small>
                    Teacher: {c.teacher.displayName ?? c.teacher.name ?? c.teacher.email}
                  </small>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
