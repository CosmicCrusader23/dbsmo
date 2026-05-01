# Admin Guide

## Getting Started

1. **Sign in** using your school Google account (`@g.dbs.edu.hk`), or use the developer bypass in local mode.
2. After sign-in you land on the **Training Dashboard** with a Teacher View badge.

## Creating a Problem Set (GUI)

1. Click **Create Set** in the sidebar.
2. Fill out the set title, slug, topic tags, and settings.
   - **Order ID:** If you leave the `order` as `0` or blank, the system automatically assigns the next available number.
3. Add problems one-by-one, including the LaTeX statement, answer type, and answer key.
4. You can also preview the LaTeX live.
5. Click **Save problem set** to finish. The set will show you as the uploader.

## Uploading a Problem Set (JSON)

1. Click **JSON Import** in the sidebar.
2. Drag-and-drop or click to select a `.json` file (max 5 MB).
3. The system performs a **dry-run** validation and shows a preview:
   - Set title, slug, problem count.
   - Any warnings or errors.
4. If the preview looks correct, click **Import draft** to create the set as a draft.

See [import-format.md](./import-format.md) for the JSON format specification.

## Publishing a Set

1. Go to **Manage Sets** in the sidebar.
   - **Shortcut:** Admins also see a "Manage Set" gear icon directly on the public problem set page, next to the bookmark button.
2. Click **View** on the set you want to publish.
3. In the set detail page, change the **Status** dropdown from `Draft` to `Published`.
4. Click **Save changes**.
5. The set is now visible to students. It will display "Uploaded by [Your Name]".

## Managing Students

1. Click **Students** in the sidebar to see all registered students.
2. The table shows name, email, group, sets completed, average score, joining date, and last active date.
   - **Average Score Logic:** Note that the average score is now calculated as the average of the student's **best performance** per unique problem set, rewarding mastery rather than penalizing retakes.
3. Click a student name to see their **detail page** with:
   - Attempt history and scores.
   - Topic accuracy breakdown.
   - Per-set performance.

## Viewing Analytics

1. Click **Analytics** in the sidebar.
2. The overview page shows:
   - Total responses, overall accuracy, topics tracked, problem sets.
   - **Topic accuracy heatmap** with color-coded cards.
   - **Hardest questions** ranked by lowest accuracy.
3. Click **Export CSV** to download attempt or student data.

### Per-Set Analytics

1. In **Manage Sets**, click the analytics icon next to a set.
2. View per-question accuracy bars, score distribution buckets, and recent attempts.

## Handling Feedback

1. Click **Feedback** in the sidebar to open the admin feedback queue.
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
