# Admin Guide

## Getting Started

1. **Sign in** using your school Google account (`@g.dbs.edu.hk`), or use the developer bypass in local mode.
2. After sign-in you land on the **Training Dashboard** with a Teacher View badge.
3. On phones and tablets, tap the **DBSMO** topbar menu button to open the compact sidebar sheet. The popup is designed to fit without its own scroll area.

## Admin Panel

Staff-only tools are grouped under **Admin Panel** in the sidebar so the primary navigation stays compact. The panel is available at `/admin` and only shows tools allowed by the signed-in role:

- **Content:** Manage sets, create a set, and JSON import.
- **People & classes:** Students and Classes, including assignments and announcements.
- **Insights & operations:** Analytics, Feedback queue, and Audit log.

Each destination keeps its own server-side permission check; hiding a tile is only a navigation convenience, not an authorization boundary.

## Sidebar Settings

Open **Settings** and switch from **Account** to **Sidebar** using the section switcher. Drag links to reorder them, use the eye and arrow controls to hide or move them, and select approved tools from the Admin Panel catalog. Preferences are normalized and saved to the signed-in account, with an account-scoped browser cache for immediate updates. There is no arbitrary custom URL field.

- Use the up/down controls to reorder links.
- Use the eye control to show or hide a link. At least one link remains visible so navigation cannot be completely lost.
- Add an internal path or an `http(s)` URL with a label and Lucide icon. External links open in a new tab.
- **Reset to default** removes custom links and restores the current default order.

These preferences are client-side layout settings, not permissions. Admin pages and APIs still enforce their server-side role checks.

## Creating a Problem Set (GUI)

1. Open **Admin Panel** and click **Create a set**.
2. Fill out the set title, slug, topic tags, and settings.
   - **Order ID:** The identifier shown in the set grid (e.g. `1`, `2`, `20212`, `A1`). Accepts any text and uses natural sorting, so `2` appears before `10`. If left blank, the system assigns the next available number.
   - **Set tags:** Enter comma-separated names or use the suggested chips. New names are created when the set is saved and become filterable categories in the problem-set catalog.
   - **Tests tag:** Use the set tag `Tests` for school test papers that have 20 problems with levels `(1)`, `(2)`, and `(3)`. Store these as 60 answerable questions so the student page renders a grouped 20×3 answer sheet.
3. Add problems one-by-one, including statement, answer type, and answer key.
   - **Problem Number:** A positive integer (e.g. 1, 2, 3). If you leave it as-is, new problems default to sequential numbers.
   - **Question tags:** Enter any comma-separated names to create or reuse Practice topics. A topic appears in Practice after more than 10 published, unsolved questions use that tag.
   - **Multiple choice:** Select **Multiple choice**, add between two and 20 choices, and mark one correct choice. Choice text supports LaTeX. Use the image control on a choice for an image-backed or image-only option.
4. For each problem, use the **LaTeX / HTML** toggle next to the statement field.
   - Use **LaTeX** for `$...$`/`$$...$$` style input.
   - Table environments (`tabular`, `tabular*`, `tabularx`, and `longtable`) and chemistry with `\ce{...}` are supported through the compatibility renderer; see [LaTeX rendering support](./latex-support.md).
   - Use **HTML** for content that includes tags like `<math>...</math>`.
5. You can preview the statement live before saving.
   - If you upload per-problem images, **Toggle Previews** renders them below the statement using the same image tokens used on the student problem page.
   - Expand **Asymptote diagram** to render diagram source and attach the resulting PNG. The server must have the sandboxed renderer enabled; see [Asymptote diagrams](./asymptote.md).
6. Click **Save problem set** to finish. The set will show you as the uploader.

## Uploading a Problem Set (JSON)

1. Open **Admin Panel** and click **JSON import**.
2. Drag-and-drop or click to select a `.json` file (max 5 MB).
3. The system performs a **dry-run** validation and shows a preview:
   - Set title, slug, problem count.
   - Any warnings or errors.
4. If the preview looks correct, click **Import draft** to create the set as a draft.
   - Optional field: `statementFormat` (default: `LATEX`). Set it to `HTML` for statements using `<math>` tags.
   - For test papers, set top-level `topicTags` to include `Tests` and import 60 problem entries in order.
   - Multiple-choice entries use `answerType: "multiple_choice"`, an `options` array of two to 20 choices, and a 1-based `correctOption`.
   - Choice objects may use `imageRef`; place those files in the same-name companion image ZIP. Statements may use `<asy>...</asy>` when the server renderer is enabled.

See [import-format.md](./import-format.md) for the JSON format specification.

### Batch ZIP actions

For a parent ZIP containing multiple JSON files and optional same-name image ZIPs, the batch importer provides three explicit actions:

1. **Dry run everything** validates every child archive concurrently and shows each preview without creating sets.
2. **Publish/Draft everything** commits only the files whose dry runs passed. The server still applies each JSON file's requested status and permission checks.
3. **Upload everything** runs validation for all files and commits the whole batch only when every dry run passes.

The progress indicator reports completed child files. Browser and server ZIP limits remain in force, including path traversal checks, compressed/expanded byte limits, entry limits, and image-only companion ZIP validation.

## Managing Sets

1. Open **Admin Panel** -> **Manage sets**.
   - Use the **Search bar** to find sets by title, slug, order, tag, or status.
   - Use the **Status filter** to view All, Published, Draft, or Archived sets.
   - **Shortcut:** Admins also see a "Manage Set" gear icon directly on the public problem set page, next to the bookmark button.
2. Click **View** on the set you want to edit or publish.
3. In the set detail page, change the **Status** dropdown from `Draft` to `Published`.
4. Click **Save changes**.
5. The set is now visible to students. It will display "Uploaded by [Your Name]".

### Authored Tasks on Profiles

User profile pages include an **Authored tasks** section above the set/problem grid. Public viewers see authored sets that are currently visible to students. Staff and profile owners can also see draft or archived authored sets, with quick links to open the set, view analytics, or manage it when their role allows those actions.

## Class Announcements

Teachers and admins can post class announcements from the **Classes** page.

1. Open **Classes** in the sidebar.
2. Open the **Announcements** tab.
3. In **Message classes**, enter an announcement title and message.
4. Select one or more target classes.
5. Click **Post**.

The same tab lists existing announcements. Admins can delete any announcement; teachers can delete announcements they authored. Students in the selected classes see messages pinned at the top of their dashboard the next time the page loads. There is no real-time push.

## Managing Students

1. Open **Admin Panel** -> **Students** to see all registered students.
2. The table shows name, email, group, visible sets tried, Mastery Index, best-set average, evidence level, attempt count, joining date, and last active date.
   - **Mastery Index:** Combines confidence-adjusted proficiency (65%), breadth (20%), and a lower-quartile consistency floor (15%).
   - **Best-set average:** Keeps the best attempt per visible set and gives every set equal weight, regardless of its maximum marks.
   - **Evidence:** Limited for 1-4 attempted sets, developing for 5-14, and established for 15 or more.
3. Click a student name to see their **detail page** with:
   - Attempt history and scores.
   - Topic accuracy breakdown.
   - Per-set performance.
4. Click an attempt number to review its per-question responses, accepted answers, awarded marks, and available explanations. Attempt numbers in per-set analytics open the same review.
5. Use the **Submissions** button on a set to inspect the newest 20 attempts per page, filter by friends or display name, and open answer review for any listed attempt.

## Viewing Analytics

1. Open **Admin Panel** -> **Analytics**.
2. The overview page shows:
   - Total responses, overall accuracy, topics tracked, problem sets.
   - **Topic accuracy heatmap** with color-coded cards.
   - **Hardest questions** ranked by lowest accuracy.
3. Click **Export CSV** to download attempt or student data.

Student CSV exports include every Performance Profile component. The exact formulas and 100-student × 100-set validation are documented in [Performance Model](./performance-model.md).

### Per-Set Analytics

1. In **Manage Sets**, click the analytics icon next to a set. You can also open analytics from a problem set header when signed in as an admin, or from the set editor topbar.
2. View per-question accuracy bars, score distribution buckets, and recent attempts.

## Handling Feedback

1. Open **Admin Panel** -> **Feedback queue**.
2. Reports are listed with reporter, set, question number, type, message, status, and date.
3. For each report you can:
   - **Review**: Mark as "Reviewing" to indicate you're looking into it.
   - **Resolve**: Mark as "Resolved" when the issue is fixed.
   - **Reject**: Mark as "Rejected" if the report is invalid.

### Feedback Types

| Type               | Meaning                                   |
| ------------------ | ----------------------------------------- |
| `wrong_answer_key` | The correct answer in the system is wrong |
| `wrong_solution`   | The provided solution file has an error   |
| `typo`             | Typo in the problem statement             |
| `unclear`          | The problem wording is confusing          |
| `other`            | Anything else                             |

## Updating Answer Keys

1. Go to **Manage Sets** → select a set → **Edit**.
2. Modify the answer key values in the answer key panel.
3. Click **Save changes**.
4. If students have already attempted the set, consider triggering a regrade.

## Exporting Data

- **Attempts CSV**: `GET /api/admin/export?type=attempts` — downloads all attempt data.
- **Students CSV**: `GET /api/admin/export?type=students` — downloads student summary data.

Use the **Export CSV** button on the Analytics page for quick access.

## Dark Mode

Click the theme toggle button (☀️/🌙) in the top-right topbar area to switch between light and dark mode. The preference is saved in your browser.

## App Footer

Every page footer shows the current app version, repository link, and Cosmic Crusader website link. Version `v0.67.0` is the current deployed app label.
