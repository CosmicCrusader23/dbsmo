import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { notFound } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { PageBackLink } from "@/app/page-back-link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isVisibleToStudent } from "@/lib/visibility";
import { WriteupsClient } from "./writeups-client";

export const dynamic = "force-dynamic";

type WriteupsPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ sort?: string }>;
};

export default async function ProblemSetWriteupsPage({ params, searchParams }: WriteupsPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    notFound();
  }

  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const sortMode = query?.sort === "top" ? "top" : "latest";
  const [currentUser, problemSet] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    }),
    prisma.problemSet.findUnique({
      where: { slug },
      include: {
        writeups: {
          include: {
            author: {
              select: {
                id: true,
                email: true,
                name: true,
                displayName: true,
                avatarUrl: true,
                image: true,
              },
            },
            images: {
              orderBy: { sortOrder: "asc" },
              include: {
                file: {
                  select: {
                    id: true,
                    originalName: true,
                  },
                },
              },
            },
            votes: {
              select: {
                userId: true,
                value: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        },
      },
    }),
  ]);

  if (!currentUser || !problemSet) {
    notFound();
  }
  if (currentUser.role !== "ADMIN" && !isVisibleToStudent(problemSet)) {
    notFound();
  }

  const writeups = problemSet.writeups
    .map((writeup) => ({
      id: writeup.id,
      title: writeup.title,
      body: writeup.body,
      contentFormat: writeup.contentFormat,
      createdAt: writeup.createdAt.toISOString(),
      score: writeup.votes.reduce((sum, vote) => sum + vote.value, 0),
      myVote: writeup.votes.find((vote) => vote.userId === currentUser.id)?.value ?? 0,
      canDelete: currentUser.role === "ADMIN" || writeup.author.id === currentUser.id,
      author: writeup.author,
      images: writeup.images.map((image) => ({
        id: image.id,
        url: `/api/files/${image.file.id}`,
        name: image.file.originalName,
      })),
    }))
    .sort((a, b) =>
      sortMode === "top"
        ? b.score - a.score || Date.parse(b.createdAt) - Date.parse(a.createdAt)
        : Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );

  return (
    <main className="single-page writeups-page">
      <div className="background-layers" aria-hidden="true">
        <span className="bg-band bg-band-one" />
        <span className="bg-band bg-band-two" />
        <span className="bg-spark bg-spark-two" />
      </div>
      <div className="page-frame">
        <header className="topbar standalone">
          <div>
            <p className="eyebrow">{problemSet.slug}</p>
            <h1 className="problem-title-row">
              <MessageSquareText size={24} />
              <span>{problemSet.title} writeups</span>
            </h1>
          </div>
          <div className="topbar-actions">
            <PageBackLink destination="Problem Set" href={`/problem-sets/${problemSet.slug}`} />
          </div>
        </header>

        <nav className="writeup-sort-tabs" aria-label="Writeup sorting">
          <Link
            className={`writeup-sort-tab${sortMode === "latest" ? " active" : ""}`}
            href={`/problem-sets/${problemSet.slug}/writeups`}
          >
            Latest
          </Link>
          <Link
            className={`writeup-sort-tab${sortMode === "top" ? " active" : ""}`}
            href={`/problem-sets/${problemSet.slug}/writeups?sort=top`}
          >
            Top
          </Link>
        </nav>

        <WriteupsClient
          problemSetId={problemSet.id}
          problemSetSlug={problemSet.slug}
          writeups={writeups}
        />
      </div>
    </main>
  );
}
