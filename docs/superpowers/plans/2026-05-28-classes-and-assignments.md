# Classes and Assignments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let teachers create classes, add students by username, and assign published problem sets with optional due dates; let students see what's been assigned to them.

**Architecture:** Three new Prisma models (`Class`, `ClassMember`, `Assignment`). All teacher routes gated by `admin:users` (no new permission key). Completion is derived live from existing `Attempt` rows — never denormalized. Student-side surface is a dashboard widget and a filter chip on `/problem-sets`; no standalone `/assignments` page.

**Tech Stack:** Next.js 15 App Router · NextAuth · Prisma + Postgres · KaTeX (rendering only) · Vitest (Node env) · `lucide-react`. No Tailwind — write CSS in `app/globals.css` next to sibling rules. Path alias `@/*` → repo root.

**Spec:** `docs/superpowers/specs/2026-05-28-classes-and-assignments-design.md`

---

## File Structure

| Path | Action | Responsibility |
| --- | --- | --- |
| `prisma/schema.prisma` | modify | add 3 models, 3 user-side relations |
| `lib/classes.ts` | create | pure helpers (completion derivation, validation) |
| `tests/classes.test.ts` | create | unit tests for `lib/classes.ts` |
| `app/api/admin/classes/route.ts` | create | `POST` create, `GET` list |
| `app/api/admin/classes/[id]/route.ts` | create | `GET` detail, `PATCH` rename, `DELETE` |
| `app/api/admin/classes/[id]/members/route.ts` | create | `POST` add students |
| `app/api/admin/classes/[id]/members/[sid]/route.ts` | create | `DELETE` remove a student |
| `app/api/admin/classes/[id]/assignments/route.ts` | create | `POST` create assignment |
| `app/api/admin/classes/[id]/assignments/[aid]/route.ts` | create | `PATCH` due date, `DELETE` |
| `app/api/admin/classes/student-search/route.ts` | create | `GET` typeahead for the roster picker |
| `app/api/admin/classes/set-search/route.ts` | create | `GET` typeahead for published sets |
| `app/api/assignments/mine/route.ts` | create | student's assignments + completion |
| `app/admin/classes/page.tsx` | create | list of classes |
| `app/admin/classes/new/page.tsx` | create | create-class form (server) |
| `app/admin/classes/new/new-class-form.tsx` | create | client component for student picker |
| `app/admin/classes/[id]/page.tsx` | create | class detail (server) |
| `app/admin/classes/[id]/class-detail-client.tsx` | create | client roster/assignments UI |
| `app/dashboard/assignments-widget.tsx` | create | client widget — "Assigned to you" |
| `app/dashboard/page.tsx` | modify | mount the widget |
| `app/problem-sets/page.tsx` | modify | thread the "Assigned" filter chip |
| `app/site-sidebar.tsx` | modify | add "Classes" link |
| `app/globals.css` | modify | append class-page + widget styles next to siblings |
| `SETUP.md` | modify | one-line note under "Deploying this pull" |

Each API file owns one resource. UI splits server-component pages from `"use client"` interactive children, matching the rest of the repo.

---

## Task 1: Add Prisma models for Class, ClassMember, Assignment

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Append the three new models**

Add at the end of `prisma/schema.prisma`:

```prisma
model Class {
  id          String        @id @default(cuid())
  name        String
  teacherId   String
  teacher     User          @relation("ClassTeacher", fields: [teacherId], references: [id], onDelete: Cascade)
  members     ClassMember[]
  assignments Assignment[]
  createdAt   DateTime      @default(now())

  @@index([teacherId])
}

model ClassMember {
  classId   String
  studentId String
  class     Class    @relation(fields: [classId], references: [id], onDelete: Cascade)
  student   User     @relation("ClassMembership", fields: [studentId], references: [id], onDelete: Cascade)
  addedAt   DateTime @default(now())

  @@id([classId, studentId])
  @@index([studentId])
}

model Assignment {
  id           String     @id @default(cuid())
  classId      String
  problemSetId String
  assignedById String
  dueAt        DateTime?
  createdAt    DateTime   @default(now())
  class        Class      @relation(fields: [classId], references: [id], onDelete: Cascade)
  problemSet   ProblemSet @relation(fields: [problemSetId], references: [id], onDelete: Cascade)
  assignedBy   User       @relation("AssignmentAuthor", fields: [assignedById], references: [id])

  @@unique([classId, problemSetId])
  @@index([classId])
  @@index([problemSetId])
}
```

- [ ] **Step 2: Add three back-relations to the `User` model**

In `prisma/schema.prisma`, inside `model User { … }`, append (alongside the other relation lines):

```prisma
  teachingClasses     Class[]              @relation("ClassTeacher")
  classMemberships    ClassMember[]        @relation("ClassMembership")
  authoredAssignments Assignment[]         @relation("AssignmentAuthor")
```

- [ ] **Step 3: Add the back-relation on `ProblemSet`**

In `prisma/schema.prisma`, inside `model ProblemSet { … }`, alongside the other relation lines, append:

```prisma
  assignments    Assignment[]
```

- [ ] **Step 4: Apply schema and regenerate client**

Run:

```bash
npx prisma db push
npx prisma generate
```

Expected: `Your database is now in sync with your Prisma schema. Done in …`. Then `Generated Prisma Client …`.

- [ ] **Step 5: Verify typecheck still passes (no callers yet, so nothing to break)**

Run: `npm run typecheck`
Expected: exit 0, no output beyond the script banner.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(classes): add Class, ClassMember, Assignment models"
```

---

## Task 2: Pure helpers + unit tests for completion + validation

**Files:**
- Create: `lib/classes.ts`
- Create: `tests/classes.test.ts`

The helpers are pure (no Prisma, no I/O) so they're trivially testable in the existing Vitest Node env. API routes will call these.

- [ ] **Step 1: Write the failing tests**

Create `tests/classes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildCompletionMap,
  validateClassName,
  type AttemptForCompletion,
} from "../lib/classes";

describe("validateClassName", () => {
  it("accepts a normal name", () => {
    expect(validateClassName("Form 4 OI")).toEqual({ ok: true, value: "Form 4 OI" });
  });

  it("trims surrounding whitespace", () => {
    expect(validateClassName("  Form 4  ")).toEqual({ ok: true, value: "Form 4" });
  });

  it("rejects empty / whitespace-only", () => {
    expect(validateClassName("   ").ok).toBe(false);
  });

  it("rejects > 80 chars", () => {
    expect(validateClassName("x".repeat(81)).ok).toBe(false);
  });
});

describe("buildCompletionMap", () => {
  const assignmentCreatedAt = new Date("2026-01-01T00:00:00Z");
  const studentIds = ["s1", "s2", "s3"];
  const attempts: AttemptForCompletion[] = [
    // s1 completed AFTER assignment — counts
    { userId: "s1", submittedAt: new Date("2026-01-02T10:00:00Z") },
    // s1 also has a later one — earlier wins
    { userId: "s1", submittedAt: new Date("2026-01-05T10:00:00Z") },
    // s2 completed BEFORE assignment — does not count
    { userId: "s2", submittedAt: new Date("2025-12-30T10:00:00Z") },
    // s3 has no rows
  ];

  it("returns earliest qualifying submittedAt for each student", () => {
    const map = buildCompletionMap({ assignmentCreatedAt, studentIds, attempts });
    expect(map.get("s1")?.toISOString()).toBe("2026-01-02T10:00:00.000Z");
    expect(map.get("s2")).toBeNull();
    expect(map.get("s3")).toBeNull();
  });

  it("includes every studentId in the map", () => {
    const map = buildCompletionMap({ assignmentCreatedAt, studentIds, attempts });
    expect(map.size).toBe(3);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/classes.test.ts`
Expected: FAIL — `Cannot find module '../lib/classes'`.

- [ ] **Step 3: Implement the helpers**

Create `lib/classes.ts`:

```ts
export type AttemptForCompletion = { userId: string; submittedAt: Date };

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

const NAME_MAX = 80;

export function validateClassName(input: string): ValidationResult<string> {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { ok: false, error: "Name cannot be empty." };
  if (trimmed.length > NAME_MAX) {
    return { ok: false, error: `Name must be ${NAME_MAX} characters or fewer.` };
  }
  return { ok: true, value: trimmed };
}

export function buildCompletionMap(input: {
  assignmentCreatedAt: Date;
  studentIds: string[];
  attempts: AttemptForCompletion[];
}): Map<string, Date | null> {
  const result = new Map<string, Date | null>();
  for (const id of input.studentIds) result.set(id, null);
  const cutoff = input.assignmentCreatedAt.getTime();
  for (const a of input.attempts) {
    if (!result.has(a.userId)) continue;
    if (a.submittedAt.getTime() <= cutoff) continue;
    const existing = result.get(a.userId);
    if (existing === null || a.submittedAt < existing) {
      result.set(a.userId, a.submittedAt);
    }
  }
  return result;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/classes.test.ts`
Expected: PASS, 6 passed.

- [ ] **Step 5: Run full test suite to confirm no regressions**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/classes.ts tests/classes.test.ts
git commit -m "feat(classes): pure helpers (validateClassName, buildCompletionMap) + tests"
```

---

## Task 3: API — create + list classes

**Files:**
- Create: `app/api/admin/classes/route.ts`

- [ ] **Step 1: Write the route**

Create `app/api/admin/classes/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { validateClassName } from "@/lib/classes";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  studentIds: z.array(z.string().min(1)).max(200).default([]),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role, "admin:users")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const isAdmin = user.role === "ADMIN";
  const classes = await prisma.class.findMany({
    where: isAdmin ? {} : { teacherId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      teacher: { select: { id: true, displayName: true, name: true, email: true } },
      _count: { select: { members: true, assignments: true } },
    },
  });

  return NextResponse.json({
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      teacher: {
        id: c.teacher.id,
        name: c.teacher.displayName ?? c.teacher.name ?? c.teacher.email,
      },
      memberCount: c._count.members,
      assignmentCount: c._count.assignments,
      createdAt: c.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role, "admin:users")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }

  const validated = validateClassName(parsed.data.name);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 422 });
  }

  // Validate student ids exist.
  const studentIds = Array.from(new Set(parsed.data.studentIds));
  if (studentIds.length > 0) {
    const found = await prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true },
    });
    if (found.length !== studentIds.length) {
      return NextResponse.json({ error: "Unknown student id." }, { status: 422 });
    }
  }

  const created = await prisma.class.create({
    data: {
      name: validated.value,
      teacherId: session.user.id,
      members: { create: studentIds.map((id) => ({ studentId: id })) },
    },
    select: { id: true },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Verify lint scoped to this file**

Run: `npx next lint --file app/api/admin/classes/route.ts` (if your eslint runner supports `--file`; otherwise `npm run lint` and grep for `classes`).
Expected: no errors for this file.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/classes/route.ts
git commit -m "feat(classes): POST/GET /api/admin/classes"
```

---

## Task 4: API — class detail, rename, delete

**Files:**
- Create: `app/api/admin/classes/[id]/route.ts`

- [ ] **Step 1: Write the route**

Create `app/api/admin/classes/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { validateClassName, buildCompletionMap } from "@/lib/classes";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

async function loadAuthorizedClass(classId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role, "admin:users")) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) {
    return { error: NextResponse.json({ error: "Class not found." }, { status: 404 }) };
  }
  if (user.role !== "ADMIN" && cls.teacherId !== userId) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  return { cls, user };
}

export async function GET(_req: Request, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const auth = await loadAuthorizedClass(id, session.user.id);
  if ("error" in auth) return auth.error;

  const detail = await prisma.class.findUnique({
    where: { id },
    include: {
      members: {
        orderBy: { addedAt: "asc" },
        include: {
          student: { select: { id: true, displayName: true, name: true, email: true } },
        },
      },
      assignments: {
        orderBy: { createdAt: "desc" },
        include: {
          problemSet: { select: { id: true, slug: true, title: true } },
        },
      },
    },
  });
  if (!detail) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 }) ;
  }

  // Completion: one query for all assignments × members.
  const studentIds = detail.members.map((m) => m.studentId);
  const setIds = detail.assignments.map((a) => a.problemSetId);
  const attempts =
    studentIds.length === 0 || setIds.length === 0
      ? []
      : await prisma.attempt.findMany({
          where: {
            userId: { in: studentIds },
            problemSetId: { in: setIds },
          },
          select: { userId: true, problemSetId: true, submittedAt: true },
        });

  const assignments = detail.assignments.map((a) => {
    const relevantAttempts = attempts.filter((at) => at.problemSetId === a.problemSetId);
    const completion = buildCompletionMap({
      assignmentCreatedAt: a.createdAt,
      studentIds,
      attempts: relevantAttempts.map((at) => ({ userId: at.userId, submittedAt: at.submittedAt })),
    });
    const completed = Array.from(completion.values()).filter((d) => d !== null).length;
    return {
      id: a.id,
      problemSet: a.problemSet,
      dueAt: a.dueAt,
      createdAt: a.createdAt,
      completedCount: completed,
      totalCount: studentIds.length,
      perStudent: detail.members.map((m) => ({
        studentId: m.studentId,
        completedAt: completion.get(m.studentId) ?? null,
      })),
    };
  });

  return NextResponse.json({
    id: detail.id,
    name: detail.name,
    teacherId: detail.teacherId,
    createdAt: detail.createdAt,
    members: detail.members.map((m) => ({
      id: m.studentId,
      name: m.student.displayName ?? m.student.name ?? m.student.email,
      email: m.student.email,
      addedAt: m.addedAt,
    })),
    assignments,
  });
}

const patchSchema = z.object({ name: z.string().min(1).max(120) });

export async function PATCH(request: Request, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const auth = await loadAuthorizedClass(id, session.user.id);
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }
  const validated = validateClassName(parsed.data.name);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 422 });
  }
  await prisma.class.update({
    where: { id },
    data: { name: validated.value },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const auth = await loadAuthorizedClass(id, session.user.id);
  if ("error" in auth) return auth.error;
  await prisma.class.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add "app/api/admin/classes/[id]/route.ts"
git commit -m "feat(classes): GET/PATCH/DELETE /api/admin/classes/[id]"
```

---

## Task 5: API — add/remove members

**Files:**
- Create: `app/api/admin/classes/[id]/members/route.ts`
- Create: `app/api/admin/classes/[id]/members/[sid]/route.ts`

- [ ] **Step 1: POST add members**

Create `app/api/admin/classes/[id]/members/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

const schema = z.object({ studentIds: z.array(z.string().min(1)).min(1).max(200) });

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role, "admin:users")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const cls = await prisma.class.findUnique({ where: { id } });
  if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  if (user.role !== "ADMIN" && cls.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }

  const studentIds = Array.from(new Set(parsed.data.studentIds));
  const found = await prisma.user.findMany({
    where: { id: { in: studentIds } },
    select: { id: true },
  });
  if (found.length !== studentIds.length) {
    return NextResponse.json({ error: "Unknown student id." }, { status: 422 });
  }

  await prisma.classMember.createMany({
    data: studentIds.map((sid) => ({ classId: id, studentId: sid })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: DELETE remove member**

Create `app/api/admin/classes/[id]/members/[sid]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; sid: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role, "admin:users")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const { id, sid } = await ctx.params;
  const cls = await prisma.class.findUnique({ where: { id } });
  if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  if (user.role !== "ADMIN" && cls.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  await prisma.classMember.deleteMany({
    where: { classId: id, studentId: sid },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add "app/api/admin/classes/[id]/members"
git commit -m "feat(classes): add/remove members"
```

---

## Task 6: API — assignments (create / patch due / delete)

**Files:**
- Create: `app/api/admin/classes/[id]/assignments/route.ts`
- Create: `app/api/admin/classes/[id]/assignments/[aid]/route.ts`

- [ ] **Step 1: POST create assignment**

Create `app/api/admin/classes/[id]/assignments/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";

export const runtime = "nodejs";

const schema = z.object({
  problemSetId: z.string().min(1),
  dueAt: z.string().datetime().nullable().optional(),
});

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role, "admin:users")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const cls = await prisma.class.findUnique({ where: { id } });
  if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  if (user.role !== "ADMIN" && cls.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }

  const set = await prisma.problemSet.findUnique({
    where: { id: parsed.data.problemSetId },
    select: { id: true, status: true },
  });
  if (!set) {
    return NextResponse.json({ error: "Set not found." }, { status: 404 });
  }
  if (set.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Set is not published." }, { status: 422 });
  }

  try {
    const created = await prisma.assignment.create({
      data: {
        classId: id,
        problemSetId: set.id,
        assignedById: session.user.id,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      return NextResponse.json(
        { error: "Already assigned to this class." },
        { status: 409 },
      );
    }
    throw err;
  }
}
```

- [ ] **Step 2: PATCH/DELETE single assignment**

Create `app/api/admin/classes/[id]/assignments/[aid]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

const patchSchema = z.object({
  dueAt: z.string().datetime().nullable(),
});

async function authorize(classId: string, assignmentId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role, "admin:users")) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  const a = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { class: { select: { teacherId: true, id: true } } },
  });
  if (!a || a.classId !== classId) {
    return { error: NextResponse.json({ error: "Assignment not found." }, { status: 404 }) };
  }
  if (user.role !== "ADMIN" && a.class.teacherId !== userId) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  return { ok: true } as const;
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string; aid: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id, aid } = await ctx.params;
  const auth = await authorize(id, aid, session.user.id);
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }

  await prisma.assignment.update({
    where: { id: aid },
    data: { dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; aid: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id, aid } = await ctx.params;
  const auth = await authorize(id, aid, session.user.id);
  if ("error" in auth) return auth.error;

  await prisma.assignment.delete({ where: { id: aid } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add "app/api/admin/classes/[id]/assignments"
git commit -m "feat(classes): create/edit/delete assignments"
```

---

## Task 7: API — typeahead helpers (student search, set search)

**Files:**
- Create: `app/api/admin/classes/student-search/route.ts`
- Create: `app/api/admin/classes/set-search/route.ts`

- [ ] **Step 1: Student typeahead**

Create `app/api/admin/classes/student-search/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role, "admin:users")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { displayName: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 20,
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true, name: true, email: true },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.displayName ?? u.name ?? u.email,
      email: u.email,
    })),
  });
}
```

- [ ] **Step 2: Published-set typeahead**

Create `app/api/admin/classes/set-search/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role, "admin:users")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  const sets = await prisma.problemSet.findMany({
    where: {
      status: "PUBLISHED",
      ...(q.length >= 2
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { title: "asc" },
    take: 20,
    select: { id: true, slug: true, title: true },
  });

  return NextResponse.json({ sets });
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/classes/student-search app/api/admin/classes/set-search
git commit -m "feat(classes): typeahead routes for student and set pickers"
```

---

## Task 8: API — student-side `/api/assignments/mine`

**Files:**
- Create: `app/api/assignments/mine/route.ts`

- [ ] **Step 1: Write the route**

Create `app/api/assignments/mine/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const memberships = await prisma.classMember.findMany({
    where: { studentId: session.user.id },
    select: {
      class: {
        select: {
          id: true,
          name: true,
          assignments: {
            include: {
              problemSet: {
                select: { id: true, slug: true, title: true, _count: { select: { problems: true } } },
              },
            },
          },
        },
      },
    },
  });

  type Row = {
    assignmentId: string;
    classId: string;
    className: string;
    problemSet: { id: string; slug: string; title: string; totalProblems: number };
    dueAt: Date | null;
    createdAt: Date;
    completedAt: Date | null;
  };

  const rows: Row[] = [];
  const setIds = new Set<string>();
  for (const m of memberships) {
    for (const a of m.class.assignments) {
      setIds.add(a.problemSetId);
      rows.push({
        assignmentId: a.id,
        classId: m.class.id,
        className: m.class.name,
        problemSet: {
          id: a.problemSet.id,
          slug: a.problemSet.slug,
          title: a.problemSet.title,
          totalProblems: a.problemSet._count.problems,
        },
        dueAt: a.dueAt,
        createdAt: a.createdAt,
        completedAt: null,
      });
    }
  }

  if (rows.length > 0) {
    const attempts = await prisma.attempt.findMany({
      where: {
        userId: session.user.id,
        problemSetId: { in: Array.from(setIds) },
      },
      select: { problemSetId: true, submittedAt: true },
      orderBy: { submittedAt: "asc" },
    });
    for (const r of rows) {
      const earliest = attempts.find(
        (a) => a.problemSetId === r.problemSet.id && a.submittedAt > r.createdAt,
      );
      r.completedAt = earliest?.submittedAt ?? null;
    }
  }

  return NextResponse.json({ assignments: rows });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add app/api/assignments/mine/route.ts
git commit -m "feat(classes): GET /api/assignments/mine"
```

---

## Task 9: Sidebar — add "Classes" link

**Files:**
- Modify: `app/site-sidebar.tsx`
- Modify: `app/site-sidebar-nav.tsx`

- [ ] **Step 1: Add the icon to the icon map**

In `app/site-sidebar-nav.tsx`, add `GraduationCap` to the `lucide-react` import and the `ICON_MAP`. Read the file first, then edit:

```tsx
import {
  ...
  GraduationCap,
  ...
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  ...,
  GraduationCap,
  ...,
};
```

- [ ] **Step 2: Add the sidebar entry**

In `app/site-sidebar.tsx`, inside the `if (hasPermission(user.role, "admin:users"))` block, append:

```tsx
links.push({ href: "/admin/classes", label: "Classes", icon: "GraduationCap" });
```

(Insert it next to the existing `admin/students` push for visual grouping.)

- [ ] **Step 3: Verify typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add app/site-sidebar.tsx app/site-sidebar-nav.tsx
git commit -m "feat(classes): sidebar entry"
```

---

## Task 10: Teacher UI — classes list page

**Files:**
- Create: `app/admin/classes/page.tsx`
- Modify: `app/globals.css` (append `.classes-*` styles)

- [ ] **Step 1: Server page**

Create `app/admin/classes/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Append CSS**

In `app/globals.css`, near other `.admin-*` or shell rules, append:

```css
.classes-shell { padding: 24px; max-width: 1100px; margin: 0 auto; }
.classes-shell .topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.classes-empty { padding: 36px; border: 1px dashed var(--color-border); border-radius: 14px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; color: var(--color-muted); }
.classes-grid { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
.classes-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border-radius: 14px; border: 1px solid var(--color-border); background: var(--color-surface); transition: border-color 120ms ease; }
.classes-card:hover { border-color: var(--color-pink); }
.classes-card h2 { font-size: 1.05rem; margin: 0; color: var(--color-text-strong); }
.classes-card-meta { display: flex; gap: 14px; color: var(--color-muted); font-weight: 600; font-size: 0.85rem; margin: 0; }
.classes-card small { color: var(--color-muted); }
```

- [ ] **Step 3: Build to confirm CSS + JSX parse cleanly**

Run: `npm run build`
Expected: exit 0. Look for "Compiled successfully".

- [ ] **Step 4: Commit**

```bash
git add app/admin/classes/page.tsx app/globals.css
git commit -m "feat(classes): teacher list page"
```

---

## Task 11: Teacher UI — create-class form

**Files:**
- Create: `app/admin/classes/new/page.tsx`
- Create: `app/admin/classes/new/new-class-form.tsx`

- [ ] **Step 1: Server wrapper**

Create `app/admin/classes/new/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Client form with student typeahead**

Create `app/admin/classes/new/new-class-form.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";

type Match = { id: string; name: string; email: string };

export function NewClassForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [picked, setPicked] = useState<Match[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setMatches([]);
      return;
    }
    const ctrl = new AbortController();
    fetch(`/api/admin/classes/student-search?q=${encodeURIComponent(trimmed)}`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d: { users: Match[] }) => {
        const pickedIds = new Set(picked.map((p) => p.id));
        setMatches(d.users.filter((u) => !pickedIds.has(u.id)));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [query, picked]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, studentIds: picked.map((p) => p.id) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create class.");
        return;
      }
      router.push(`/admin/classes/${data.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="classes-shell">
      <header className="topbar">
        <Link href="/admin/classes" className="secondary-action">
          <ArrowLeft size={16} /> Classes
        </Link>
      </header>

      <form className="classes-form" onSubmit={submit}>
        <label>
          <span className="eyebrow">Class name</span>
          <input
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Form 4 OI"
            required
            maxLength={80}
          />
        </label>

        <label>
          <span className="eyebrow">Add students</span>
          <input
            className="form-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
          />
        </label>

        {matches.length > 0 ? (
          <ul className="classes-pick-list">
            {matches.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPicked((cur) => [...cur, m]);
                    setQuery("");
                  }}
                >
                  <Plus size={14} /> {m.name} <small>{m.email}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <ul className="classes-pick-chips">
          {picked.map((p) => (
            <li key={p.id}>
              <span>{p.name}</span>
              <button
                type="button"
                aria-label={`Remove ${p.name}`}
                onClick={() => setPicked((cur) => cur.filter((c) => c.id !== p.id))}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>

        {error ? <p className="classes-error">{error}</p> : null}

        <button type="submit" className="primary-action" disabled={submitting || !name.trim()}>
          {submitting ? <Loader2 size={16} className="spin-icon" /> : null} Create class
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Append form CSS in `app/globals.css`**

Append:

```css
.classes-form { display: flex; flex-direction: column; gap: 14px; max-width: 520px; }
.classes-form label { display: flex; flex-direction: column; gap: 6px; }
.classes-pick-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; max-height: 220px; overflow-y: auto; }
.classes-pick-list button { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; background: var(--color-surface-alt); border: 1px solid var(--color-border); border-radius: 8px; text-align: left; cursor: pointer; }
.classes-pick-list button small { color: var(--color-muted); margin-left: auto; }
.classes-pick-chips { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.classes-pick-chips li { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 999px; background: rgba(240, 93, 155, 0.12); color: var(--color-pink); font-weight: 600; }
.classes-pick-chips button { background: transparent; border: none; cursor: pointer; padding: 0; display: inline-flex; }
.classes-error { color: var(--color-danger); font-weight: 600; }
```

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add app/admin/classes/new app/globals.css
git commit -m "feat(classes): create-class form with roster picker"
```

---

## Task 12: Teacher UI — class detail page

**Files:**
- Create: `app/admin/classes/[id]/page.tsx`
- Create: `app/admin/classes/[id]/class-detail-client.tsx`

- [ ] **Step 1: Server wrapper**

Create `app/admin/classes/[id]/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Client component (renders detail, manages roster + assignments)**

Create `app/admin/classes/[id]/class-detail-client.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";

type Member = { id: string; name: string; email: string; addedAt: string };
type SetSummary = { id: string; slug: string; title: string };
type Assignment = {
  id: string;
  problemSet: SetSummary;
  dueAt: string | null;
  createdAt: string;
  completedCount: number;
  totalCount: number;
  perStudent: { studentId: string; completedAt: string | null }[];
};
type Detail = {
  id: string;
  name: string;
  members: Member[];
  assignments: Assignment[];
};

export function ClassDetailClient({ classId }: { classId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/admin/classes/${classId}`, { cache: "no-store" });
    if (!res.ok) {
      setError((await res.json()).error ?? "Failed to load.");
      return;
    }
    setDetail(await res.json());
  }, [classId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function addMembers(ids: string[]) {
    setBusy(true);
    try {
      await fetch(`/api/admin/classes/${classId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: ids }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(studentId: string) {
    setBusy(true);
    try {
      await fetch(`/api/admin/classes/${classId}/members/${studentId}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function assignSet(setId: string, dueAt: string | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/classes/${classId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemSetId: setId, dueAt }),
      });
      if (!res.ok) setError((await res.json()).error ?? "Failed.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeAssignment(aid: string) {
    setBusy(true);
    try {
      await fetch(`/api/admin/classes/${classId}/assignments/${aid}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return (
      <main className="classes-shell">
        <p>{error ?? "Loading…"}</p>
      </main>
    );
  }

  return (
    <main className="classes-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Class</p>
          <h1>{detail.name}</h1>
        </div>
        <Link href="/admin/classes" className="secondary-action">
          <ArrowLeft size={16} /> Back
        </Link>
      </header>

      {error ? <p className="classes-error">{error}</p> : null}

      <section>
        <h2>Roster ({detail.members.length})</h2>
        <RosterPicker onPick={addMembers} excludeIds={detail.members.map((m) => m.id)} disabled={busy} />
        <ul className="classes-roster">
          {detail.members.map((m) => (
            <li key={m.id}>
              <span>
                <strong>{m.name}</strong>
                <small>{m.email}</small>
              </span>
              <button
                type="button"
                aria-label={`Remove ${m.name}`}
                onClick={() => void removeMember(m.id)}
                disabled={busy}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Assignments ({detail.assignments.length})</h2>
        <AssignmentPicker onAssign={assignSet} disabled={busy} />
        <ul className="classes-assignments">
          {detail.assignments.map((a) => (
            <li key={a.id}>
              <div>
                <strong>{a.problemSet.title}</strong>
                <small>
                  {a.dueAt ? `Due ${new Date(a.dueAt).toLocaleDateString()}` : "No due date"}
                </small>
              </div>
              <span className="classes-progress">
                <CheckCircle2 size={14} /> {a.completedCount} / {a.totalCount}
              </span>
              <button
                type="button"
                aria-label="Delete assignment"
                onClick={() => void removeAssignment(a.id)}
                disabled={busy}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function RosterPicker({
  onPick,
  excludeIds,
  disabled,
}: {
  onPick: (ids: string[]) => void | Promise<void>;
  excludeIds: string[];
  disabled: boolean;
}) {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<{ id: string; name: string; email: string }[]>([]);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setMatches([]);
      return;
    }
    const ctrl = new AbortController();
    fetch(`/api/admin/classes/student-search?q=${encodeURIComponent(trimmed)}`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        const ex = new Set(excludeIds);
        setMatches(d.users.filter((u: { id: string }) => !ex.has(u.id)));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [q, excludeIds]);

  return (
    <div>
      <input
        className="form-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Add students by name or email"
        disabled={disabled}
      />
      {matches.length > 0 ? (
        <ul className="classes-pick-list">
          {matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  void onPick([m.id]);
                  setQ("");
                }}
              >
                <Plus size={14} /> {m.name} <small>{m.email}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AssignmentPicker({
  onAssign,
  disabled,
}: {
  onAssign: (setId: string, dueAt: string | null) => void | Promise<void>;
  disabled: boolean;
}) {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [picked, setPicked] = useState<{ id: string; title: string } | null>(null);
  const [due, setDue] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/admin/classes/set-search?q=${encodeURIComponent(q.trim())}`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => setMatches(d.sets))
      .catch(() => {});
    return () => ctrl.abort();
  }, [q]);

  return (
    <div className="classes-assign-picker">
      {!picked ? (
        <>
          <input
            className="form-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search published sets"
            disabled={disabled}
          />
          {matches.length > 0 ? (
            <ul className="classes-pick-list">
              {matches.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setPicked({ id: s.id, title: s.title })}>
                    <Plus size={14} /> {s.title} <small>{s.slug}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <div className="classes-assign-confirm">
          <strong>{picked.title}</strong>
          <input
            type="date"
            className="form-input"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          <button
            type="button"
            className="primary-action"
            disabled={disabled}
            onClick={() => {
              const dueAt = due ? new Date(`${due}T23:59:00`).toISOString() : null;
              void onAssign(picked.id, dueAt);
              setPicked(null);
              setDue("");
              setQ("");
            }}
          >
            Assign
          </button>
          <button type="button" className="secondary-action" onClick={() => setPicked(null)}>
            <X size={14} /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Append CSS**

In `app/globals.css`, append:

```css
.classes-roster, .classes-assignments { list-style: none; padding: 0; margin: 12px 0 0; display: flex; flex-direction: column; gap: 6px; }
.classes-roster li, .classes-assignments li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; background: var(--color-surface-alt); border: 1px solid var(--color-border); border-radius: 10px; }
.classes-roster li > span { display: flex; flex-direction: column; }
.classes-roster li small { color: var(--color-muted); font-size: 0.78rem; }
.classes-assignments li > div { display: flex; flex-direction: column; }
.classes-assignments li small { color: var(--color-muted); font-size: 0.78rem; }
.classes-progress { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: var(--color-success); }
.classes-roster li button, .classes-assignments li button { background: transparent; border: none; color: var(--color-muted); cursor: pointer; }
.classes-roster li button:hover, .classes-assignments li button:hover { color: var(--color-danger); }
.classes-assign-picker { margin-top: 8px; }
.classes-assign-confirm { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 10px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface-alt); }
.classes-shell section { margin-top: 24px; }
.classes-shell section h2 { font-size: 1.1rem; margin: 0 0 8px; }
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add "app/admin/classes/[id]" app/globals.css
git commit -m "feat(classes): teacher detail page (roster + assignments)"
```

---

## Task 13: Student dashboard widget — "Assigned to you"

**Files:**
- Create: `app/dashboard/assignments-widget.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Read the dashboard page first to find the right mount point**

Run: `cat app/dashboard/page.tsx`
Skim until you find where existing widgets are rendered. Pick a slot near the top of the main grid.

- [ ] **Step 2: Create the client widget**

Create `app/dashboard/assignments-widget.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList } from "lucide-react";

type Assigned = {
  assignmentId: string;
  className: string;
  problemSet: { id: string; slug: string; title: string; totalProblems: number };
  dueAt: string | null;
  completedAt: string | null;
};

export function AssignmentsWidget() {
  const [items, setItems] = useState<Assigned[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/assignments/mine", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { assignments: Assigned[] }) => {
        if (cancelled) return;
        const sorted = d.assignments.slice().sort((a, b) => {
          const aDone = a.completedAt !== null;
          const bDone = b.completedAt !== null;
          if (aDone !== bDone) return aDone ? 1 : -1;
          const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
          const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
          return aDue - bDue;
        });
        setItems(sorted.slice(0, 5));
      })
      .catch(() => setItems([]));
    return () => {
      cancelled = true;
    };
  }, []);

  if (items === null || items.length === 0) return null;

  return (
    <section className="panel assignments-widget">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Assigned to you</p>
          <h2>
            <ClipboardList size={18} /> {items.length}
          </h2>
        </div>
      </div>
      <ul>
        {items.map((a) => (
          <li key={a.assignmentId}>
            <Link href={`/problem-sets/${a.problemSet.slug}`}>
              <strong>{a.problemSet.title}</strong>
              <small>{a.className}</small>
              {a.dueAt ? (
                <span className="assignments-widget-due">
                  Due {new Date(a.dueAt).toLocaleDateString()}
                </span>
              ) : null}
              {a.completedAt ? (
                <span className="assignments-widget-done">
                  <CheckCircle2 size={14} /> done
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Mount on the dashboard**

In `app/dashboard/page.tsx`, import the widget at the top of the file:

```tsx
import { AssignmentsWidget } from "./assignments-widget";
```

Render `<AssignmentsWidget />` near the top of the main column (above existing widgets). Exact placement: pick a JSX slot inside the main `<section>` that wraps the dashboard content; consult the file to choose. The widget is self-hiding when there are 0 assignments, so placement is safe.

- [ ] **Step 4: Append CSS**

```css
.assignments-widget ul { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-direction: column; gap: 6px; }
.assignments-widget li a { display: grid; grid-template-columns: minmax(0,1fr) auto auto; column-gap: 10px; row-gap: 2px; align-items: center; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface-alt); text-decoration: none; color: var(--color-text-strong); }
.assignments-widget li a:hover { border-color: var(--color-pink); }
.assignments-widget li small { grid-column: 1; color: var(--color-muted); font-size: 0.78rem; }
.assignments-widget-due { font-size: 0.78rem; color: var(--color-muted); font-weight: 600; }
.assignments-widget-done { display: inline-flex; align-items: center; gap: 4px; color: var(--color-success); font-weight: 700; font-size: 0.78rem; }
```

- [ ] **Step 5: Build and verify**

Run: `npm run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/assignments-widget.tsx app/dashboard/page.tsx app/globals.css
git commit -m "feat(classes): dashboard 'Assigned to you' widget"
```

---

## Task 14: Problem-sets — "Assigned" filter chip + per-card badge

**Files:**
- Modify: `app/problem-sets/page.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Read the file to find the filter row and card render**

Run: `cat app/problem-sets/page.tsx`. Locate the filter chip group and the per-card render. Note the prop or query param the existing filters use.

- [ ] **Step 2: Server-side fetch the user's assigned set ids**

In `app/problem-sets/page.tsx`, after the existing session and user lookup, add:

```tsx
const assignedSetRows = await prisma.classMember.findMany({
  where: { studentId: session.user.id },
  select: {
    class: {
      select: {
        name: true,
        assignments: { select: { problemSetId: true, dueAt: true, createdAt: true } },
      },
    },
  },
});
const assignedSets = new Map<
  string,
  { className: string; dueAt: Date | null; createdAt: Date }
>();
for (const m of assignedSetRows) {
  for (const a of m.class.assignments) {
    if (!assignedSets.has(a.problemSetId)) {
      assignedSets.set(a.problemSetId, {
        className: m.class.name,
        dueAt: a.dueAt,
        createdAt: a.createdAt,
      });
    }
  }
}
```

- [ ] **Step 3: Read the URL search param for the filter and apply it**

Where the existing page reads `searchParams`, add support for `?filter=assigned`. When set, narrow the set list:

```tsx
const filter = searchParams.filter;
const filteredSets = filter === "assigned"
  ? sets.filter((s) => assignedSets.has(s.id))
  : sets;
```

(Adapt variable names to the existing page; the prior step's `cat` shows them.)

- [ ] **Step 4: Render the chip when applicable**

In the existing filter row, conditionally render:

```tsx
{assignedSets.size > 0 ? (
  <Link
    href={filter === "assigned" ? "/problem-sets" : "/problem-sets?filter=assigned"}
    className={`chip${filter === "assigned" ? " is-active" : ""}`}
  >
    Assigned
  </Link>
) : null}
```

(Match the existing chip class; if it isn't named `chip`, use whatever class the sibling chips use.)

- [ ] **Step 5: Add a discreet "Assigned" badge on cards**

Inside the existing card render, when `assignedSets.has(set.id)`:

```tsx
{assignedSets.has(set.id) ? (
  <span className="set-card-assigned-badge">
    Assigned
    {assignedSets.get(set.id)!.dueAt
      ? ` · due ${new Date(assignedSets.get(set.id)!.dueAt!).toLocaleDateString()}`
      : ""}
  </span>
) : null}
```

- [ ] **Step 6: Append CSS**

```css
.set-card-assigned-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-weight: 700; font-size: 0.72rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-pink); background: rgba(240, 93, 155, 0.12); }
```

- [ ] **Step 7: Build to confirm**

Run: `npm run build`
Expected: success.

- [ ] **Step 8: Commit**

```bash
git add app/problem-sets/page.tsx app/globals.css
git commit -m "feat(classes): assigned filter chip and per-card badge"
```

---

## Task 15: SETUP.md note for the schema migration

**Files:**
- Modify: `SETUP.md`

- [ ] **Step 1: Read the existing "Deploying this pull" subsection and pattern-match**

Run: `grep -n 'Deploying this pull' SETUP.md`. Edit that subsection (or add a new dated subsection beneath it) noting the new tables.

- [ ] **Step 2: Add the note**

Append (or replace the existing subsection content) with:

```md
### Deploying this pull (classes and assignments)

Standard redeploy. `prisma db push` will create three new tables:
`Class`, `ClassMember`, `Assignment`. Verify after deploy with:

```
psql -U dbsmo -h localhost dbsmo -c '\d "Class"'
psql -U dbsmo -h localhost dbsmo -c '\d "Assignment"'
```
```

- [ ] **Step 3: Commit**

```bash
git add SETUP.md
git commit -m "docs(setup): note classes/assignments schema bump"
```

---

## Task 16: End-to-end smoke + final push

- [ ] **Step 1: Run the full local check**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: all pass.

- [ ] **Step 2: Push to origin**

Run: `git push origin main`
Expected: push accepted.

- [ ] **Step 3: Manual smoke (without browser-harness — manual is fine)**

Open `http://localhost:3000`. Sign in as a teacher account.

1. Sidebar shows "Classes" — click it, list is empty.
2. Click "New class" → name = "Smoke 4 OI", search a known student by email, pick them, submit.
3. Detail page loads, roster has the student. Use the assign picker to find a published set, set a due date, click "Assign".
4. Assignment row shows `0 / 1` complete.
5. Sign in as the student in another browser. Dashboard widget shows the assignment. `/problem-sets` shows the "Assigned" chip and the badge on that set.
6. Complete an attempt of that set. Dashboard widget gains the "done" check, teacher detail now shows `1 / 1`.

If any step fails, fix and re-run from step 1.

- [ ] **Step 4: Update CENTRAL.md**

Move the "What's currently in flight" entry for this work to "Recently shipped" with a one-liner. Keep CENTRAL.md current per AGENTS.md. Commit & push.

```bash
git add CENTRAL.md
git commit -m "docs(central): record classes + assignments shipped"
git push origin main
```

---

## Self-review notes (already applied in this plan)

- Spec coverage walkthrough: schema (T1), permissions (woven into T3-T8), teacher routes (T3-T7), student route (T8), teacher UI (T10-T12), student UI (T13-T14), errors (encoded in routes), testing (T2 covers pure helpers; the spec accepts no API-route tests), deploy note (T15). All items mapped.
- No placeholders ("TBD", "implement later") — every step has the actual code or the actual command.
- Type consistency: `buildCompletionMap` signature is identical in T2 and T4. `Assignment` shape returned by `/api/admin/classes/[id]` matches what T12 consumes. `/api/assignments/mine` row shape matches T13 widget consumer.
- One spec note refined inline: `Attempt` has no `status` column — completion is `submittedAt > assignment.createdAt`, which the spec now reflects and `buildCompletionMap` matches.
