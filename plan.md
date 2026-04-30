# MO Training Platform Plan

## Immediate Request: Search + JSON Import + LaTeX Repair (2026-04-30)

- [x] Add search for users.
- [x] Add search for tasks/problem sets.
- [x] Make category selection change the bottom task table to that category instead of listing all sets.
- [x] Keep category cards showing only category counts and category controls.
- [x] Rewrite the admin ZIP upload flow into a JSON problem-set upload flow.
- [x] Support JSON fields for LaTeX problem statements, answer type, answer keys, accepted answers, topic tags, explanations, solutions, video URL, and visibility metadata.
- [x] Fix LaTeX rendering on problem-set pages and verify it in-browser.
- [x] Validate the updated search, category, JSON upload, and LaTeX flows with browser harness on localhost.
- [x] Re-check this section and mark completed items.

## Immediate Request: Sorting + Friends + Score Rings (2026-04-30)

- [x] Let students/admins order the problem-set list by solve count.
- [x] Let users order the leaderboard by solved count or average score.
- [x] Add a leaderboard friends view that shows only the current user and favorited friends.
- [x] Add a heart/favorite control on user profiles to friend or unfriend that user.
- [x] Fix the answer-result circle so it shows the actual percentage correct.
- [x] Check other circular progress indicators and make them reflect real progress.
- [x] Validate the updated flows with browser harness on localhost.
- [x] Re-check this section and mark completed items.

## Immediate Request: UX + Problem-Set Upgrade (2026-04-29)

- [x] Add a profile button that opens `/users/[username]`.
- [x] Show the user's profile picture between the theme toggle and username in the top-right account area.
- [x] Add easy "Back to Dashboard" navigation from Feedback, Leaderboard, Users, and profile pages.
- [x] Prevent further submissions once a user has a perfect-score attempt for a problem set.
- [x] Fix problem-set rendering so problem statements display LaTeX correctly on the student set page.
- [x] Add a dedicated `/problem-sets` page that categorizes sets using:
  - Series
  - Trigonometry
  - Geometry
  - Cogeom
  - Algebra
  - Number Theory
  - Combinatorics
  - Others
- [x] Make admin tagging UX support the standard category tags plus custom tags.
- [x] Ensure custom-tag sets appear under **Others** in the categorized problem-set view.
- [x] Build/upgrade an admin problem-set editor so admins can edit set metadata and problem content.
- [x] Let admins promote other users to admin from the user profile page.
- [x] Let admins upload a PDF instead of manually entering problems, choose the number of answer boxes, and attach it to a problem set.
- [x] Let students open/enlarge the attached PDF from the problem-set page and verify PDF rendering.
- [x] Fix hosted/VPS landing-page auth so Google sign-in is visible when configured and local dev-only bypass/dev copy is hidden in production.
- [x] Run browser-harness validation after implementation.
- [x] Re-check this section and mark all completed items.

## Goal

Build a self-paced mathematics olympiad training platform for about 120 team members, with room to later open access to PD students. The platform should replace Google Forms with a proper account system, structured problem sets, automatic answer-only grading, student progress tracking, videos, solution links, feedback reports, and teacher analytics.

The first version should focus on making problem-set upload, answering, grading, and progress tracking reliable. It does not need to solve olympiad problems or generate official solutions.

## Product Scope

### Core Users

- Student: logs in with a school email, views assigned problem sets, watches attached teaching videos, enters answers, submits attempts, checks progress, and reports issues.
- Teacher/admin: uploads problem sets by ZIP, manages users and sets, reviews submissions, tracks progress, analyzes strengths and weaknesses, and handles user feedback.
- Future PD student: same as student, but possibly with different access rules, group membership, and visible sets.

### Main Workflows

1. Admin uploads a ZIP file containing problem-set metadata, answer keys, optional PDF files, optional solution files, and optional video links.
2. System validates the ZIP, previews what will be created, then imports or updates problem sets.
3. Student logs in with school email.
4. Student opens a problem set, reads the problems, watches the teaching video if attached, enters answer-only responses, and submits.
5. System grades answers immediately and stores attempt history.
6. Student sees progress across all sets, including completion, score, accuracy by topic, and retry status.
7. Student can open linked solution files when allowed.
8. Student reports wrong answers, wrong solution links, typo issues, or unclear statements.
9. Admin dashboard shows per-user progress, per-set performance, weak topics, outlier questions, and unresolved reports.

## Recommended Tech Stack

Use a boring monolith first. The scale is small, and the main risk is correctness and maintainability rather than traffic.

- Frontend/backend: Next.js with TypeScript.
- UI: React, server components where useful, CSS modules or Tailwind with a local design-token layer.
- Database: PostgreSQL.
- ORM: Prisma.
- Auth: Auth.js/NextAuth with Google OAuth and a school-domain allowlist.
- File storage: S3-compatible object storage, Supabase Storage, Cloudflare R2, or local disk for development.
- Background jobs: simple database-backed queue first; move to BullMQ/Redis only if imports or analytics become heavy.
- Deployment: single app deployment plus managed Postgres and object storage.
- Testing: Vitest for units, Playwright for key workflows.

## Visual Direction

Reference: https://colorfulstage.com/

The platform can take inspiration from the reference site's energetic rhythm-game style, but should not copy proprietary CSS, artwork, logos, character assets, or exact layout. Create an original school-training identity using similar high-level visual language.

### Theme Keywords

- Bright, friendly, progress-driven, game-like, clean, and rewarding.
- Colorful but still readable for repeated study sessions.
- More dashboard/tool than marketing page.

### Color Tokens

```css
:root {
  --color-text: #555577;
  --color-bg: #f7fbff;
  --color-surface: #ffffff;
  --color-cyan: #78eedd;
  --color-purple: #b97bff;
  --color-pink: #ff7cc1;
  --color-blue: #45a0ff;
  --color-orange: #ffa94b;
  --color-success: #1bbf89;
  --color-warning: #f7a928;
  --color-danger: #ef4b6c;
  --shadow-soft: 0 5px 15px rgba(0, 0, 0, 0.18);
  --radius-card: 6px;
  --radius-pill: 999px;
}
```

### UI Style

- Use Montserrat or a similar geometric sans-serif for headings and navigation.
- Use a highly readable sans-serif for body and math-adjacent text.
- Use white cards with `6px` radius and soft shadows for repeated items.
- Use cyan primary actions with dark text; on hover, invert to dark text surface with cyan accents.
- Use purple, pink, blue, and orange as category colors for topics, status chips, and analytics.
- Use subtle patterned backgrounds, sparkles, diagonal bands, or parallax-like decorative layers created in-house.
- Use progress bars, streak indicators, completion badges, and topic chips to make training feel rewarding.
- Avoid heavy gradients everywhere; keep color accents purposeful.

### Key Screens

- Student dashboard: progress summary, due/next sets, recent scores, topic strengths, feedback status.
- Problem set page: problem PDF/viewer, answer entry grid, video panel, solution link area, submit button, attempt history.
- Admin dashboard: cohort overview, filters, export, weak-topic heatmaps, low-performing questions, feedback queue.
- ZIP import wizard: upload, validation report, preview, conflict resolution, final import result.

## Data Model

### User

- `id`
- `email`
- `name`
- `role`: `student`, `admin`
- `group`: e.g. `MO`, `PD`, graduation year, class, or custom cohort
- `createdAt`
- `lastLoginAt`

### ProblemSet

- `id`
- `slug`
- `title`
- `description`
- `order`
- `status`: `draft`, `published`, `archived`
- `visibleFrom`
- `visibleTo`
- `allowedGroups`
- `topicTags`
- `difficulty`
- `problemFileId`
- `solutionFileId`
- `videoUrl`
- `createdBy`
- `createdAt`
- `updatedAt`

### Problem

- `id`
- `problemSetId`
- `number`
- `answerKey`
- `answerType`: `exact`, `integer`, `decimal`, `fraction`, `set`, `multiple`
- `acceptedAnswers`
- `caseSensitive`
- `explanationNote`
- `topicTags`
- `points`

### Attempt

- `id`
- `userId`
- `problemSetId`
- `attemptNumber`
- `score`
- `maxScore`
- `submittedAt`
- `durationSeconds`
- `gradedAt`

### Response

- `id`
- `attemptId`
- `problemId`
- `rawAnswer`
- `normalizedAnswer`
- `isCorrect`
- `pointsAwarded`
- `graderNote`

### FeedbackReport

- `id`
- `userId`
- `problemSetId`
- `problemId`
- `type`: `wrong_answer_key`, `wrong_solution`, `typo`, `unclear`, `other`
- `message`
- `status`: `open`, `reviewing`, `resolved`, `rejected`
- `adminNote`
- `createdAt`
- `resolvedAt`

### ImportedFile

- `id`
- `storageKey`
- `originalName`
- `mimeType`
- `sizeBytes`
- `checksum`
- `uploadedBy`
- `createdAt`

## ZIP Uploader

The ZIP uploader is the highest-leverage admin feature. It should let teachers upload one archive and have the platform create or update the problem set automatically.

### Import Modes

- Create new sets from a ZIP.
- Update existing sets by `slug`.
- Dry-run validation before writing to the database.
- Roll back the import if any required item fails.

### Recommended ZIP Structure

```text
mo-set-001.zip
  manifest.yml
  problems.pdf
  solution.pdf
  answers.csv
  assets/
    diagram-01.png
```

### `manifest.yml`

```yaml
slug: mo-set-001
title: MO Set 001 - Algebra Basics
description: Introductory answer-only algebra practice.
order: 1
status: draft
allowedGroups:
  - MO
topicTags:
  - algebra
  - equations
difficulty: 2
problemFile: problems.pdf
solutionFile: solution.pdf
videoUrl: https://example.com/video
answersFile: answers.csv
```

### `answers.csv`

```csv
number,answerType,answer,acceptedAnswers,topicTags,points
1,integer,42,,algebra,1
2,fraction,3/7,"0.428571;3:7",number_theory,1
3,set,"1,2,5","{1,2,5};1 2 5",combinatorics,1
```

### Import Validation

- ZIP is readable and below the configured size limit.
- `manifest.yml` exists and matches schema.
- `answers.csv` exists and has exactly the required columns.
- Problem numbers are unique and sequential unless explicitly allowed.
- Required referenced files exist.
- Video URL is valid if provided.
- Answer types are supported.
- Accepted answers can be parsed.
- Existing slug conflicts are shown before update.
- Admin sees a preview before final import.

### Import Result

After import, show:

- Created/updated problem set.
- Number of problems imported.
- Attached problem file and solution file.
- Video link status.
- Warnings, skipped rows, or conflicts.
- Link to open the draft set.

## Grading Engine

Start with deterministic answer-only grading.

### Normalization Rules

- Trim whitespace.
- Normalize repeated spaces.
- Normalize case when `caseSensitive` is false.
- Normalize common full-width punctuation if students may type it.
- Normalize fractions such as `3/6` to `1/2` where the answer type allows equivalent fractions.
- Normalize comma-separated sets by sorting entries when order does not matter.
- Preserve raw student answer for audit/debugging.

### Supported Answer Types

- `exact`: string match after normalization.
- `integer`: numeric integer match.
- `decimal`: numeric comparison with optional tolerance.
- `fraction`: rational equivalence.
- `set`: unordered collection of values.
- `multiple`: any accepted answer is correct.

### Admin Override

Admins need a way to:

- Add accepted answers after reports.
- Regrade all affected attempts.
- Mark a question as invalid and remove it from scoring.
- Leave a note explaining the change.

## Student Features

### Account and Access

- Login with Google school email.
- Reject non-school domains by default.
- Admin can manually invite or approve exceptions.
- User profile stores name, email, role, group, and progress metadata.

### Dashboard

- Overall completion percentage.
- Sets completed out of 100.
- Current average score.
- Best score per set.
- Recent submissions.
- Topic strengths and weak areas.
- Recommended next set.
- Open feedback reports and their statuses.

### Problem Set Page

- Problem statement viewer or PDF link.
- Teaching video embed or external link.
- Answer grid for 100 answer-only responses.
- Autosave draft answers.
- Submit and grade.
- Attempt history.
- Best score and latest score.
- Solution link if the set allows it.
- Report issue button for each problem and for the set as a whole.

### Progress Page

- HKOJ-like table with one row per set.
- Columns: set, topics, status, best score, latest attempt, attempts, last submitted, solution viewed.
- Filters by topic, status, difficulty, and group.
- Visual markers for solved, attempted, not started, and needs review.

## Admin Features

### Admin Dashboard

- Cohort completion overview.
- Student leaderboard by completion and accuracy.
- Per-student detail view.
- Per-set analytics.
- Topic heatmap.
- Questions with unusually low correctness.
- Questions with many feedback reports.
- Export CSV for scores and completion.

### User Management

- View all users.
- Assign roles.
- Assign groups.
- Disable accounts.
- Import user list by CSV later if needed.

### Problem Set Management

- ZIP import wizard.
- Draft/publish/archive controls.
- Edit metadata.
- Replace problem PDF, solution PDF, or video URL.
- Edit answer key.
- Trigger regrade.

### Feedback Queue

- Filter by status, type, set, problem, and reporter.
- Link each report to the exact problem and current answer key.
- Resolve, reject, or convert to answer-key update.
- Notify affected students in-app after fixes.

## Analytics

### Student Analytics

- Completion rate.
- Accuracy by topic.
- Best score trend.
- Attempts per set.
- Time between first open and first submission.
- Sets needing review.

### Admin Analytics

- Cohort progress distribution.
- Topic weakness matrix.
- Per-question correctness rate.
- Problem sets with high drop-off.
- Students inactive for configurable time.
- Feedback volume by set and question.

## Permissions

| Action                            | Student | Admin    |
| --------------------------------- | ------- | -------- |
| View published sets for own group | Yes     | Yes      |
| Submit answers                    | Yes     | Optional |
| View own progress                 | Yes     | Yes      |
| View all progress                 | No      | Yes      |
| Upload ZIP                        | No      | Yes      |
| Edit answer key                   | No      | Yes      |
| Regrade attempts                  | No      | Yes      |
| Resolve feedback                  | No      | Yes      |
| Manage users                      | No      | Yes      |

## Security and Privacy

- Enforce school-domain login and role-based authorization on the server.
- Do not trust client-side role checks.
- Store uploaded files outside the public web root unless intentionally public.
- Generate signed URLs for private problem and solution files.
- Virus-scan ZIP uploads if available in deployment environment.
- Limit ZIP size and decompressed size to prevent zip bombs.
- Validate file extensions and MIME types.
- Rate-limit login, submit, feedback, and upload endpoints.
- Keep audit logs for admin changes, answer-key edits, and regrades.
- Export only the minimum student data needed.

## Implementation Phases

### Phase 0: Project Setup

- [x] Initialize Next.js TypeScript app.
- [x] Add linting, formatting, test runner, and CI.
- [x] Configure PostgreSQL and Prisma.
- [x] Add environment variable templates.
- [x] Create base layout and design tokens.
- [x] Add dark mode (system preference + manual toggle).

### Phase 1: Auth and Roles

- [x] Add Google OAuth login.
- [x] Restrict login to school email domain.
- [x] Create user records on first login.
- [x] Add admin role handling.
- [x] Add protected routes and server-side authorization helpers.

### Phase 2: Problem Set Model

- [x] Add database tables for users, problem sets, problems, files, attempts, responses, and reports.
- [x] Add admin CRUD for problem-set metadata.
- [x] Add file storage abstraction.
- [x] Add draft/published visibility rules.

### Phase 3: ZIP Import

- [x] Build ZIP upload form.
- [x] Define `manifest.yml` schema.
- [x] Add basic client ZIP size and signature validation.
- [x] Parse `manifest.yml` and `answers.csv`.
- [x] Validate archive contents.
- [x] Show dry-run preview UI.
- [x] Import files and problem records transactionally.
- [x] Add import result page.

### Phase 4: Student Submission

- [x] Build student dashboard.
- [x] Build problem-set viewer.
- [x] Add answer grid UI.
- [x] Add answer grid autosave.
- [x] Add submission endpoint.
- [x] Implement deterministic grading.
- [x] Store attempts and responses.
- [x] Show score result and attempt history.

### Phase 5: Progress Tracking

- [x] Build first HKOJ-like progress table UI.
- [x] Add first per-set best score and completion status UI.
- [x] Add first topic accuracy summary UI.
- [x] Add recommended next set logic.

### Phase 6: Feedback Reports

- [x] Add report issue UI.
- [x] Store per-problem and per-set reports.
- [x] Build admin feedback queue.
- [x] Add admin resolution workflow.
- [x] Add answer-key update and regrade path.

### Phase 7: Admin Analytics

- [x] Build first cohort dashboard UI.
- [x] Build per-student detail pages (`/admin/students`, `/admin/students/[id]`).
- [x] Build per-set analytics (`/admin/sets/[id]/analytics`).
- [x] Add weak-topic heatmap (`/admin/analytics`).
- [x] Add CSV export (`/api/admin/export?type=attempts|students`).
- [x] Add shared analytics helpers (`lib/analytics.ts`).
- [x] Update sidebar nav with Students and Analytics links.

### Phase 8: Polish and Deployment

- [x] Harden import limits and auth rules.
- [ ] Add backups.
- [ ] Add seed data and demo ZIP.
- [ ] Add Playwright coverage for main workflows.
- [ ] Deploy staging.
- [ ] Run teacher acceptance test.
- [ ] Deploy production.

### Phase 9: User Profiles, Settings, Leaderboard

- [x] Add `displayName` and `avatarUrl` fields to User model (Prisma migration).
- [x] Settings page (`/settings`) — edit display name, upload profile picture.
  - Username (email) shown but read-only.
  - Display name editable (used in greetings and leaderboard).
  - Profile picture upload with default 'M' avatar.
- [x] API route for profile update (`/api/settings`).
- [x] Public user profile page (`/users/[username]`) — shows display name, username, profile picture, solved sets count.
- [x] Public users list (`/users`) — visible to both students and admins.
- [x] Leaderboard page (`/leaderboard`) — ranked by solved sets / average score, visible to all logged-in users.
- [x] Add sidebar navigation links for Users, Leaderboard, Settings.
- [x] Use display name in dashboard greeting when available.
- [x] Store and display manually-created problem statements on the problem-set page.
- [x] Make answer boxes larger and show three boxes per row on desktop.

## Browser Harness Tests

The following tests should be run via `browser-harness` to verify visual and interactive behavior.
Each entry describes the page, the expected elements, and actions to perform.

### [x] T1 — Dashboard renders with sidebar nav

- **URL**: `http://localhost:3000/`
- **Verify**:
  - Page loads with status 200.
  - Sidebar contains links: Dashboard, Problem Sets, Manage Sets, ZIP Import, Analytics, Feedback.
  - Hero section shows "Training Dashboard" heading.
  - Metric cards are visible (Completed, Average, Latest score, Open reports).
  - "Cohort snapshot" table renders with student rows.
  - Theme toggle button is visible in the sidebar.

### [x] T2 — Dark mode toggle

- **URL**: `http://localhost:3000/`
- **Actions**:
  1. Click the theme toggle button (Sun icon in sidebar).
  2. Verify `<html>` has class `dark` or `light` (cycles through light → dark → system).
  3. Verify background color changes (dark mode bg is `#0e0e1a`, light is `#f7fbff`).
  4. Click again to cycle. Verify each mode looks correct.
  5. Refresh the page — verify the chosen theme persists (localStorage `mo-theme`).

### [x] T3 — Problem set page with answer grid

- **URL**: `http://localhost:3000/problem-sets/mo-set-001`
- **Verify**:
  - Page loads with heading "Algebra Basics".
  - Left panel shows PDF placeholder.
  - Right panel shows "Response grid" with 20 answer cells.
  - Each cell has a number label and an input field.
  - Submit button exists and is disabled when no answers are filled.
- **Actions**:
  1. Type "42" into answer cell 1.
  2. Type "1/2" into answer cell 2.
  3. Verify fill count shows "2/20 answered".
  4. Verify Submit button is now enabled.
  5. Refresh the page — verify the typed answers persist (localStorage autosave).

### [x] T4 — ZIP import dry-run

- **URL**: `http://localhost:3000/admin/import`
- **Verify**:
  - Page loads with "ZIP Import" heading.
  - Drop zone is visible with "Drop a .zip file" text.
- **Actions**:
  1. Upload the file `examples/mo-set-001.zip` (drag or click).
  2. Wait for dry-run response.
  3. Verify the preview panel shows: title "MO Set 001 - Algebra Basics", slug "mo-set-001", 5 problems.
  4. Verify the "Import draft" button appears.
  5. Verify the file list shows: `answers.csv`, `manifest.yml`, `problems.pdf`, `solution.pdf`.

### [x] T5 — Admin problem-set list (requires Postgres)

- **URL**: `http://localhost:3000/admin/sets`
- **Precondition**: A running PostgreSQL database with migrated schema and at least one imported set.
- **Verify**:
  - Table shows problem sets with columns: Order, Title, Slug, Status, Problems, Difficulty, Created.
  - Status badges show correct colors (Draft = blue, Published = green, Archived = red).
  - "View" link navigates to the set detail page.
- **If no sets**: Verify empty state with "No problem sets yet" message and "Import ZIP" button.

### [x] T6 — Admin set detail/edit (requires Postgres)

- **URL**: `http://localhost:3000/admin/sets/{id}`
- **Precondition**: A valid problem set ID from T5.
- **Verify**:
  - Left panel shows metadata form (title, description, status, order, difficulty, groups, tags, video URL).
  - Right panel shows answer key with problem numbers and answer types.
  - Status badge matches current status.
- **Actions**:
  1. Change the title field.
  2. Change status to "Published".
  3. Click "Save changes".
  4. Verify green "Saved" confirmation appears.
  5. Refresh — verify changes persist.

### [x] T7 — Responsive layout

- **URL**: `http://localhost:3000/`
- **Actions**:
  1. Resize browser to 768px width.
  2. Verify sidebar collapses to a horizontal nav bar.
  3. Verify content grid switches to single column.
  4. Resize to 480px.
  5. Verify metric cards stack to single column.
  6. Verify buttons go full-width.

### [x] T8 — Dark mode on all pages

- **Actions**:
  1. Set theme to dark.
  2. Navigate through: Dashboard, Problem Sets, ZIP Import, Manage Sets, Students, Analytics.
  3. Verify each page renders with dark backgrounds, light text, and no white flashes.
  4. Verify accent colors (cyan, purple, pink) are still vibrant and legible.

### [x] T9 — Analytics overview page (requires Postgres)

- **URL**: `http://localhost:3000/admin/analytics`
- **Precondition**: A running PostgreSQL database with migrated schema, at least one imported set, and at least one submitted attempt with responses.
- **Verify**:
  - Page loads with status 200 and heading "Analytics".
  - Four metric cards are visible: "Total responses", "Overall accuracy", "Topics tracked", "Problem sets".
  - Topic accuracy heatmap section renders with heading "Topic accuracy heatmap".
  - Each topic card shows a topic name, percentage, a meter bar, and a response count.
  - Topic cards have a colored left border (green for ≥70%, orange for 40–69%, pink/red for <40%).
  - "Hardest questions" table renders with columns: Set, Q#, Responses, Accuracy.
  - Each question row has a meter bar in the last column.
  - Set names in the table are links to `/problem-sets/{slug}`.
  - "Export CSV" button is visible in the topbar.
- **Actions**:
  1. Click the "Export CSV" link/button.
  2. Verify a CSV file downloads (Content-Type `text/csv`).
  3. Verify the CSV has a header row and at least one data row.

### [x] T10 — Student list page (requires Postgres)

- **URL**: `http://localhost:3000/admin/students`
- **Precondition**: At least one user with role STUDENT in the database.
- **Verify**:
  - Page loads with heading "Students".
  - Metric cards show: "Total students", "Active this week", "Average accuracy", "Sets available".
  - Student table renders with columns: Name, Email, Group, Sets Done, Avg Score, Last Active.
  - Each student name is a link to `/admin/students/{id}`.
  - Average score cells are color-coded (green ≥70%, orange 40–69%, red <40%).
- **If no students**: Verify empty state message appears.

### [x] T11 — Student detail page (requires Postgres)

- **URL**: `http://localhost:3000/admin/students/{id}`
- **Precondition**: A valid student user ID from T10 who has submitted at least one attempt.
- **Verify**:
  - Page loads with the student's name as heading.
  - Info row shows email, group, role, and member-since date.
  - Metric cards show: "Attempts", "Sets tried", "Average score", "Best score".
  - "Topic accuracy" section renders with meter bars per topic.
  - "Attempt history" table renders with columns: Set, Attempt, Score, Date.
  - Set names in the table are links.
  - "Back to students" link navigates to `/admin/students`.

### [x] T12 — Per-set analytics page (requires Postgres)

- **URL**: `http://localhost:3000/admin/sets/{id}/analytics`
- **Precondition**: A valid problem set ID with at least one submitted attempt.
- **Verify**:
  - Page loads with heading "Analytics — {set title}".
  - Metric cards show: "Total attempts", "Unique students", "Average score", "Questions".
  - "Per-question accuracy" section renders bars for each problem number.
  - Each bar shows the problem number, percentage, and a colored meter.
  - "Score distribution" section renders 5 buckets (0–20%, 21–40%, 41–60%, 61–80%, 81–100%).
  - "Recent attempts" table renders with columns: Student, Attempt, Score, Date.
  - Student names in the table are links to `/admin/students/{id}`.
  - "Back to set" link navigates to `/admin/sets/{id}`.

### [x] T13 — CSV export API

- **URL**: `http://localhost:3000/api/admin/export?type=attempts`
- **Precondition**: At least one attempt in the database.
- **Verify**:
  - Response status is 200.
  - Content-Type header is `text/csv; charset=utf-8`.
  - Content-Disposition header contains `filename="attempts.csv"`.
  - First line is the header: `Student,Email,Problem Set,Attempt #,Score,Max Score,Percentage,Date`.
  - Subsequent lines contain comma-separated values matching the header columns.
- **URL**: `http://localhost:3000/api/admin/export?type=students`
- **Verify**:
  - Response status is 200.
  - Content-Disposition header contains `filename="students.csv"`.
  - First line is the header: `Name,Email,Group,Sets Attempted,Average Score %,Total Attempts`.

### [x] T14 — Sidebar navigation includes new links

- **URL**: `http://localhost:3000/`
- **Verify**:
  - Sidebar contains a "Students" link pointing to `/admin/students`.
  - Sidebar contains an "Analytics" link pointing to `/admin/analytics`.
  - Clicking "Students" navigates to the student list page.
  - Clicking "Analytics" navigates to the analytics overview page.

### [x] T15 — Login landing and bypass auth

- **URL**: `http://localhost:3000/`
- **Verify**:
  - Public landing page renders with the DBS Training brand, centered sign-in card, school-email copy, and bypass controls.
  - School Google button is disabled in local dev when Google OAuth secrets are absent.
  - Bypass buttons remain visible in local dev.
- **Actions**:
  1. Click `bypass as admin`.
  2. Verify redirect to `/dashboard`.
  3. Verify admin session badge and sign-out button render.

### [x] T16 — Role gating on draft and admin pages

- **Precondition**: At least one draft problem set exists and local bypass auth is enabled.
- **Actions**:
  1. Sign out from the admin session.
  2. Click `bypass as student`.
  3. Open `/problem-sets/mo-set-001` and verify the student receives a 404 for the draft set.
  4. Open `/admin/import` and verify the app redirects to `/dashboard?notice=admin-required`.

### [x] T17 — Create GUI and statement display

- **URL**: `http://localhost:3000/admin/create`
- **Actions**:
  1. Sign in with admin bypass.
  2. Create a published one-problem set through the GUI.
  3. Open the created set from `/problem-sets/{slug}`.
  4. Verify the left panel shows the problem statement instead of an empty placeholder.
  5. Verify the answer grid uses three larger columns on desktop.
  6. Submit the correct answer and verify a 100% result.

### [x] T18 — Settings, users, profiles, leaderboard

- **URL**: `http://localhost:3000/settings`
- **Actions**:
  1. Upload a profile picture under 512 KB.
  2. Set a display name and save.
  3. Verify the dashboard greeting uses the display name.
  4. Open `/users` and verify the display name and default `M` avatar behavior.
  5. Open `/leaderboard` and verify ranking by solved sets / average score.
  6. Open `/users/{id}` and verify username, display name, profile picture, and solved-set count.

### [x] T19 — Student unauthorized back-button flow

- **Actions**:
  1. Sign in with student bypass.
  2. Open an admin page such as `/admin/create`.
  3. Verify the app redirects to `/dashboard?notice=admin-required`.
  4. Press browser back and verify the app returns to a stable dashboard view instead of a broken unauthorized page.

### [x] T20 — Greeting, theme preference, and action hover polish

- **URL**: `http://localhost:3000/dashboard`, `http://localhost:3000/settings`, `http://localhost:3000/admin/sets`
- **Actions**:
  1. Sign in with admin bypass.
  2. Verify the dashboard greeting uses a rotating typewriter animation instead of static text.
  3. Switch settings between dark and light mode and verify the preference persists across navigation.
  4. Verify admin action buttons and active/hover stylesheet rules do not force white text on highlighted controls.

## Suggested First MVP

The smallest useful version is:

- School-email login.
- Admin creates/uploads one problem set by ZIP.
- Students submit answers and receive scores.
- Students see completion and best score.
- Admin sees a simple table of every student versus every set.
- Students can report an issue.

Everything else can build from there.

## Acceptance Criteria

- A teacher can upload a valid ZIP and publish a set without editing database records manually.
- A student can log in, open a published set, submit answers, and see grading results.
- Grading is deterministic and stores both raw and normalized answers.
- Progress table accurately reflects best score and completion.
- Admin can identify which students have not started, attempted, or completed each set.
- Feedback reports are visible to admins and trace back to the exact problem.
- The UI is responsive, readable, and visually consistent with the bright original theme.

## Open Decisions

- Exact school email domain allowlist.
- Whether students may retry unlimited times.
- Whether solution files are visible before submission, after submission, after a deadline, or always.
- Whether all 100 problem sets are always visible or released gradually.
- Whether PD users share the same sets or need a separate group/catalog.
- Decimal tolerance rules.
- Whether videos are uploaded files or external links only.
- Hosting provider and storage provider.

## Repository Milestones

- [x] `README.md`: project overview, setup, environment variables, and local commands.
- [x] `docs/import-format.md`: ZIP, manifest, and answer CSV specification.
- [x] `docs/grading.md`: answer normalization and grading rules.
- [x] `docs/admin-guide.md`: teacher workflow for ZIP upload, publish, feedback, and regrade.
- [x] `docs/student-guide.md`: student workflow for answering, progress, and reports.
- [x] `examples/mo-set-001.zip`: demo import archive.
