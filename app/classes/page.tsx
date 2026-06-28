import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { CheckCircle2, ClipboardList, GraduationCap, Plus } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { buildCompletionMap } from "@/lib/classes";
import { AnnouncementComposer } from "./announcement-composer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Classes · DBSMO" };

export default async function ClassesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user) redirect("/");

  const canTeach = hasPermission(user.role, "admin:users");
  const isAdmin = user.role === "ADMIN";

  const [memberships, teachingClasses] = await Promise.all([
    prisma.classMember.findMany({
      where: { studentId: session.user.id },
      orderBy: { addedAt: "desc" },
      include: {
        class: {
          include: {
            teacher: { select: { displayName: true, name: true, email: true } },
            assignments: {
              orderBy: { createdAt: "desc" },
              include: { problemSet: { select: { id: true, slug: true, title: true } } },
            },
          },
        },
      },
    }),
    canTeach
      ? prisma.class.findMany({
          where: isAdmin ? {} : { teacherId: session.user.id },
          orderBy: { createdAt: "desc" },
          include: {
            teacher: { select: { id: true, displayName: true, name: true, email: true } },
            _count: { select: { members: true, assignments: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const setIds = Array.from(
    new Set(memberships.flatMap((m) => m.class.assignments.map((a) => a.problemSetId))),
  );

  const myAttempts =
    setIds.length === 0
      ? []
      : await prisma.attempt.findMany({
          where: { userId: session.user.id, problemSetId: { in: setIds } },
          select: { problemSetId: true, submittedAt: true },
        });

  return (
    <main className="classes-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{canTeach ? "Teaching & enrolled" : "Your classes"}</p>
          <h1>
            <GraduationCap size={26} /> Classes
          </h1>
        </div>
        {canTeach ? (
          <Link href="/admin/classes/new" className="primary-action">
            <Plus size={16} /> New class
          </Link>
        ) : null}
      </header>

      {canTeach ? (
        <section>
          <AnnouncementComposer
            classes={teachingClasses.map((c) => ({
              id: c.id,
              name: c.name,
              memberCount: c._count.members,
            }))}
          />
          <h2>Classes you teach</h2>
          {teachingClasses.length === 0 ? (
            <div className="classes-empty">
              <p>No classes yet.</p>
              <Link href="/admin/classes/new" className="primary-action">
                <Plus size={16} /> Create your first class
              </Link>
            </div>
          ) : (
            <ul className="classes-grid">
              {teachingClasses.map((c) => (
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
        </section>
      ) : null}

      <section>
        <h2>{canTeach ? "Classes you're enrolled in" : "Your classes"}</h2>
        {memberships.length === 0 ? (
          <div className="classes-empty">
            <p>No classes.</p>
            <small>
              {canTeach
                ? "You're not enrolled in any class as a student."
                : "Your teacher will add you when one is set up."}
            </small>
          </div>
        ) : (
          <ul className="student-classes-list">
            {memberships.map((m) => {
              const teacherName =
                m.class.teacher.displayName ?? m.class.teacher.name ?? m.class.teacher.email;
              return (
                <li key={m.class.id} className="student-class-card">
                  <header>
                    <div>
                      <h2>{m.class.name}</h2>
                      <small>Taught by {teacherName}</small>
                    </div>
                    <span className="student-class-count">
                      {m.class.assignments.length} assignments
                    </span>
                  </header>

                  {m.class.assignments.length === 0 ? (
                    <p className="student-class-blank">No assignments yet.</p>
                  ) : (
                    <ul className="student-class-assignments">
                      {m.class.assignments.map((a) => {
                        const completion = buildCompletionMap({
                          assignmentCreatedAt: a.createdAt,
                          studentIds: [session.user.id],
                          attempts: myAttempts
                            .filter((at) => at.problemSetId === a.problemSetId)
                            .map((at) => ({
                              userId: session.user.id,
                              submittedAt: at.submittedAt,
                            })),
                        });
                        const completedAt = completion.get(session.user.id) ?? null;
                        return (
                          <li key={a.id}>
                            <Link href={`/problem-sets/${a.problemSet.slug}`}>
                              <ClipboardList size={16} />
                              <span className="student-class-assignment-title">
                                {a.problemSet.title}
                              </span>
                              {a.dueAt ? (
                                <span className="student-class-due">
                                  Due {new Date(a.dueAt).toLocaleDateString()}
                                </span>
                              ) : (
                                <span className="student-class-due muted">No due date</span>
                              )}
                              {completedAt ? (
                                <span className="student-class-done">
                                  <CheckCircle2 size={14} /> done
                                </span>
                              ) : null}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
