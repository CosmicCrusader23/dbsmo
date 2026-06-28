---
date: 2026-06-26
updated: 2026-06-28
type: components
tags: [project, architecture, components, ui, dbsmo]
ai-first: true
project: "[[dbsmo]]"
confidence: high
scanned-commit: f7e0c74
---

## For future Claude

This note maps important [[dbsmo]] UI/components to their source files and usage sites. It focuses on components that carry behavior or data flow, not every visual element.

## Global Shell

- `RootLayout` in `app/layout.tsx`: imports KaTeX CSS/global CSS, sets metadata/viewport, injects an early theme script from `localStorage`, renders `SiteSidebar`, optional mobile nav toggle, and `.site-content`.
- `SiteSidebar` in `app/site-sidebar.tsx`: server component that loads session/user and builds sidebar links based on raw admin role plus `hasPermission(...)`. It renders `SiteSidebarNav` and `GlobalMobileNavScrim`.
- `SiteSidebarNav` in `app/site-sidebar-nav.tsx`: client nav that maps link icon names to lucide icons and marks active links by pathname prefix.
- `GlobalMobileNavToggle` and `GlobalMobileNavScrim` in `app/global-mobile-nav.tsx`: mobile sidebar controls used by the root shell/sidebar.
- `AuthButton` in `app/auth-button.tsx`: sign-in/sign-out control. It renders Google sign-in, optional bypass buttons, session badge, and profile avatar link.
- `Avatar` in `app/avatar.tsx`: shared avatar display; deterministic fallback initial/tint helper lives in `lib/avatar.ts`.
- `ThemeToggle` in `app/theme-toggle.tsx`: theme control used on dashboard and problem set pages.
- `TypewriterGreeting` in `app/typewriter-greeting.tsx`: animated greeting used by dashboard and configured in settings.

## Student Dashboard and Catalog

- `DashboardPage` in `app/dashboard/page.tsx`: server-rendered dashboard that loads current user, visible sets, attempts, student rows for admins, computes completion/score/topic metrics, and renders metric cards, next actions, and recent set rows.
- `MetricCard` in `app/dashboard/page.tsx`: local component for dashboard metric cards.
- `AssignmentsWidget` in `app/dashboard/assignments-widget.tsx`: client component that fetches `/api/assignments/mine`, sorts assignments, and renders up to five dashboard assignment links.
- `ProblemSetsPage` in `app/problem-sets/page.tsx`: route page that handles catalog filtering/sorting/views/recommendations/pagination and renders set cards/links.
- `ProblemSetPage` in `app/problem-sets/[slug]/page.tsx`: route page that loads a set by slug and chooses inline-statement vs PDF/file layout.
- `AnswerGrid` in `app/problem-sets/[slug]/answer-grid.tsx`: client answer form, autosave, review-later state, submit-to-`/api/submit`, result display, missed-topic next action, and feedback report dialog. When `ProblemSetPage` detects the set tag `Tests`, it passes the test layout so answer-only/PDF sets render as a 20×3 test answer sheet for 60 underlying `Problem` rows.
- `BookmarkButton` in `app/problem-sets/[slug]/bookmark-button.tsx`: client bookmark toggle backed by `/api/problem-sets/[id]/bookmark`.
- Writeup header link in `app/problem-sets/[slug]/page.tsx`: icon link next to `BookmarkButton` that opens `/problem-sets/[slug]/writeups`.
- `WriteupsPage` and `WriteupsClient` in `app/problem-sets/[slug]/writeups/`: server/client pair for set writeups. The server page handles auth, set visibility, sorting, and initial data; the client component handles the composer, image selection, optimistic voting, and feed cards rendered with `LatexStatement`.
- `LatexStatement` in `app/problem-sets/[slug]/latex-statement.tsx`: statement renderer for LaTeX/HTML-style statements and imported image assets.

## Practice and Games

- `PracticePage` in `app/practice/page.tsx`: client practice workflow using `/api/practice/tags`, `/api/practice/next`, and `/api/practice/submit`; renders `LatexStatement`.
- `FtwLobbyForm` in `app/ftw/lobby-form.tsx`: FTW mode entry. It filters tags, creates solo matches through `/api/ftw/matches`, creates rooms through `/api/ftw/rooms`, and joins rooms through `/api/ftw/rooms/[code]/join`.
- `FtwMatchClient` in `app/ftw/match/[id]/match-client.tsx`: solo FTW problem/submit client.
- `FtwRoomClient` in `app/ftw/room/[code]/room-client.tsx`: multiplayer room UI with polling state, host actions, answer submission, locked/revealed answers, scores, and current problem rendering through `LatexStatement`.
- `PlaygroundHub` in `app/playground/hub.tsx`: boss selection/hub for playground.
- `BossBattle` in `app/playground/[slug]/battle.tsx`: client-only boss battle state machine; checks answers using `isCorrect(...)` from static boss data and stores trophies in `localStorage`.

## Admin Content Components

- `CreateSetPageClient` in `app/admin/create/page-client.tsx`: client form for manual set creation and import-draft editing, backed by `/api/admin/create-set`; supports per-problem image uploads and preview through `LatexStatement`. Uploaded images are appended as `[[img:key]]` tokens for preview/save when not already referenced.
- `StatementPreview` in `app/admin/create/page-client.tsx`: local preview for statement content/format, including problem image assets rendered by `LatexStatement`.
- `SetEditForm` in `app/admin/sets/[id]/set-edit-form.tsx`: edit form for metadata, tags, PDF upload, image upload, status, problem list, answer keys/types, points, explanations, and save to `/api/admin/sets/[id]`. It shares the same per-problem image-token append behavior before save.
- `DeleteSetButton` in `app/admin/sets/delete-set-button.tsx`: client delete action used by set management/detail flows and backed by `DELETE /api/admin/sets/[id]`.
- `JsonZipImportPanel` in `app/admin/import/json-zip-import-panel.tsx`: batch JSON ZIP import UI; unpacks `.json` files plus optional same-basename nested image ZIPs and runs dry-run/draft/commit per entry.
- `ZipImportPanel` in `app/admin/import/zip-import-panel.tsx`: single JSON import UI; accepts optional same-basename image ZIP and runs dry-run/draft/commit flow.

## Admin Classes and Assignments

- `NewClassForm` in `app/admin/classes/new/new-class-form.tsx`: class creation client; searches students through `/api/admin/classes/student-search` and posts to `/api/admin/classes`.
- `ClassDetailClient` in `app/admin/classes/[id]/class-detail-client.tsx`: class detail client; loads `/api/admin/classes/[id]`, adds/removes members, assigns/removes sets, deletes the class, and displays completion counts.
- `RosterPicker` in `app/admin/classes/[id]/class-detail-client.tsx`: local student search/add component.
- `AssignmentPicker` in `app/admin/classes/[id]/class-detail-client.tsx`: local published set search + due-date assignment component.

## Admin Analytics, Feedback, Audit

- `AnalyticsOverviewPage` in `app/admin/analytics/page.tsx`: server route that builds analytics summary/trend/filter options.
- `AnalyticsFilters` and local `SearchableSelect` in `app/admin/analytics/filters.tsx`: client filter bar that edits query params and supports searchable dropdowns/date range.
- `TrendChart` in `app/admin/analytics/trend-chart.tsx`: client SVG chart for attempts/completions/average percent trend.
- `AuditFilters` and local `SearchableSelect` in `app/admin/audit/audit-filters.tsx`: audit-log filtering UI.
- `FeedbackTable` in `app/admin/feedback/feedback-table.tsx`: feedback list/table client.
- `FeedbackActions` in `app/admin/feedback/feedback-actions.tsx`: feedback status/admin-note actions backed by admin feedback APIs.

## Users and Settings

- `SettingsPage` in `app/settings/page.tsx`: client settings editor. It fetches `/api/settings`, handles local avatar file conversion to data URL, falls back to Google `User.image` when no custom avatar is set, writes theme/typewriter settings to `localStorage`, validates and patches account settings.
- `UserProfilePage` in `app/users/[username]/page.tsx`: server-rendered public profile with avatar, friend/admin actions, progress stats, topic/completion/bookmark summaries, authored tasks table, mastery heatmap, and set/problem progress grid. Authored tasks come from `User.createdProblemSets` and show visible sets to public viewers while owners/staff can see private authored sets. The heatmap is derived from recent attempts and marks days where the user mastered visible sets.
- `FriendButton` in `app/users/[username]/friend-button.tsx`: client heart button backed by `PATCH /api/friends/[userId]`.
- `PromoteUserButton` in `app/users/[username]/promote-user-button.tsx`: admin role change UI backed by `PATCH /api/admin/users/[id]/role`.
- `LeaderboardPage` in `app/leaderboard/page.tsx`: leaderboard route with local `RankBadge` and shared `Avatar`.

## Rendering and State Patterns

- Server components usually fetch with Prisma directly and redirect/notFound on missing auth/records (sources: `app/dashboard/page.tsx`, `app/problem-sets/[slug]/page.tsx`, `app/admin/*/page.tsx`).
- Client components usually call colocated API route handlers through `fetch(...)` and keep form/UI state locally (sources: `app/problem-sets/[slug]/answer-grid.tsx`, `app/admin/classes/[id]/class-detail-client.tsx`, `app/admin/create/page-client.tsx`, `app/ftw/lobby-form.tsx`).
- Browser-only preferences use `localStorage`: theme, answer drafts, review-later lists, typewriter settings, and playground trophies (sources: `app/layout.tsx`, `app/problem-sets/[slug]/answer-grid.tsx`, `app/settings/page.tsx`, `app/playground/[slug]/battle.tsx`).
