# Classes and Assignments — Design

Status: approved 2026-05-28
Audience: teachers, admins, students
Scope: v1 only — see "Out of scope" for explicitly deferred work

## Goal

Teachers can create classes, add students to them, and assign published problem sets with optional due dates. Students see what's assigned to them and a teacher can see who has completed each assignment.

This unblocks classroom use of the platform. Today every set is publish-to-all and the only way a teacher can tell who did what is by reading the global progress page.

## Non-goals (v1)

- Practice-tag goals as assignments
- Scheduled FTW races as assignments
- Late submissions, grade rollup, score thresholds
- Class-scoped leaderboards
- Email or in-app notifications on assignment
- Student-initiated leave-class
- Bulk class import (CSV roster)
- Self-join via code (explicitly rejected — teacher selects students by username)

## Architecture

Three new Prisma models. No changes to existing models. Completion is derived from existing `Attempt` rows, not stored on the assignment.

```prisma
model Class {
  id          String          @id @default(cuid())
  name        String
  teacherId   String
  teacher     User            @relation("ClassTeacher", fields: [teacherId], references: [id], onDelete: Cascade)
  members     ClassMember[]
  assignments Assignment[]
  createdAt   DateTime        @default(now())

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

`User` gains three relation entries (`teachingClasses`, `classMemberships`, `authoredAssignments`). No new scalar columns on `User`.

Schema migration is `prisma db push` (per SETUP.md §7). Additive only.

## Permissions

Reuse `admin:users` for class create / manage. No new permission key.

- A teacher with `admin:users` can CRUD classes where `teacherId === session.user.id`.
- An admin (already has `admin:users`) can CRUD any class.
- A student needs no special permission. They see assignments where a `ClassMember` row matches their user id.

Students must be active users in `User` to be added to a class. The roster picker queries the same source as `/users`.

Assignments require the underlying `ProblemSet.status === "PUBLISHED"`. Picking an unpublished set is rejected at the API boundary.

## Data flow

### Creating an assignment

```
teacher → /admin/classes/[id] → "Assign a set"
  → POST /api/admin/classes/[id]/assignments { problemSetId, dueAt? }
  → server checks: caller owns class (or is admin), set is PUBLISHED, no existing assignment for that pair
  → insert Assignment row
```

`@@unique([classId, problemSetId])` prevents accidental duplicates. Re-assigning is `PATCH /api/admin/classes/[id]/assignments/[aid]` to edit `dueAt`. Removing is `DELETE`.

### Computing completion

For an assignment row, "complete" = the student has at least one `Attempt` row for `assignment.problemSetId` whose `submittedAt > assignment.createdAt`. (`Attempt` rows in this schema represent completed/submitted attempts; there is no separate status field.)

Implemented as a single grouped query per assignment when the teacher views the class page. We do not denormalize completion onto the Assignment row — `Attempt` is the source of truth.

### Student view of assignments

`GET /api/assignments/mine` returns:

```ts
type AssignedSet = {
  assignmentId: string;
  className: string;
  problemSet: { id, slug, name, totalProblems };
  dueAt: string | null;
  completedAt: string | null; // earliest qualifying Attempt.submittedAt, if any
};
```

Used by the dashboard widget and the "Assigned" filter chip on `/problem-sets`.

## UI

### Teacher

- **Sidebar:** new entry "Classes" under the existing teacher links, gated by `admin:users`.
- **/admin/classes** — list of classes the teacher owns (or all classes if admin). Empty state with "Create class" CTA.
- **/admin/classes/new** — name field + roster picker. Roster picker is a typeahead over `User`, multi-select, displays display-name + email. Same lookup as the `/users` directory.
- **/admin/classes/[id]** — three sections:
  1. Header: name, member count, total assignments. Edit name, delete class.
  2. Roster: list with remove buttons, "Add students" inline picker.
  3. Assignments: each row shows set name, `due Fri 5 Jun` or `no due date`, completion `7 / 12`. Click-through opens a per-student modal listing each student with their completion timestamp or "—".

### Student

- **Dashboard widget:** "Assigned to you", up to 5 entries, sorted by earliest unmet due date then by `createdAt`. Each row: set name, class name, due chip, completed checkmark or empty. Hidden entirely when there are zero assignments.
- **/problem-sets:** new filter chip "Assigned". Visible only when the student has at least one assignment. Selected → shows assigned sets only. Each card in the list gets a discreet `Assigned · due Fri` badge regardless of filter state.
- No separate `/assignments` page in v1.

## API surface

```
POST   /api/admin/classes              { name, studentIds[] }
GET    /api/admin/classes              → classes for caller
GET    /api/admin/classes/[id]         → class detail w/ roster + assignments + completion
PATCH  /api/admin/classes/[id]         { name }
DELETE /api/admin/classes/[id]
POST   /api/admin/classes/[id]/members { studentIds[] }
DELETE /api/admin/classes/[id]/members/[sid]
POST   /api/admin/classes/[id]/assignments         { problemSetId, dueAt? }
PATCH  /api/admin/classes/[id]/assignments/[aid]   { dueAt? }
DELETE /api/admin/classes/[id]/assignments/[aid]

GET    /api/assignments/mine           → student's assignments + completion
```

All routes do their own `getServerSession` + `hasPermission(role, "admin:users")` preamble for teacher routes; student route only requires a session. Pattern matches existing handlers.

## Errors

- Teacher tries to assign an unpublished set → 422 with `{ error: "Set is not published." }`.
- Teacher tries to assign the same set twice → 409. UI catches and shows "Already assigned to this class — edit the existing assignment to change the due date."
- Adding a student id that is not in `User` → 422.
- Cross-tenant access (teacher A loads class B) → 403.
- Class delete cascades to `ClassMember` and `Assignment` via `onDelete: Cascade`. We don't delete `Attempt` rows — they remain owned by the student.

## Testing

Unit / integration via Vitest:

- `tests/classes.test.ts` (new) — class create with roster, add/remove member, ownership gates.
- `tests/assignments.test.ts` (new) — assign published set succeeds, unpublished rejected, duplicate rejected (409), completion query returns expected counts after seeded `Attempt` rows.
- Extend `tests/permissions.test.ts` if it exists, otherwise no new permission tests are needed since we reuse `admin:users`.

No test for the polling student widget — the API is what we test.

## Risks and rejected alternatives

- **Why not reuse `ProblemSet.allowedGroups`?** It exists as `String[]` but unused in the runtime. Wiring it would require a `User.group` field plus group-management UI to be useful. Classes are a cleaner, more flexible primitive that doesn't lock a student to a single group. We leave `allowedGroups` alone — the import format still references it.
- **Why no Class join code?** User explicitly rejected. Teacher selects students by username, leaning on the existing user directory.
- **Why is completion derived, not stored?** Storing it would require a backfill any time grading rules change, and `Attempt` already has the data. Per-class-page query is bounded (one set per assignment, one student per member), so cost is fine for classroom-size rosters.
- **Why no `/assignments` page?** Dashboard widget + filter chip is sufficient for v1. We can lift it if students complain.

## Deploy notes

Schema additive — `prisma db push` is enough. No env vars, no new system deps. SETUP.md §7 covers the redeploy flow. Add a one-line note in SETUP.md "Deploying this pull" subsection naming the three new tables when the implementation lands.
