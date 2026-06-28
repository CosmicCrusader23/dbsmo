"use client";

import Link from "next/link";
import { useState } from "react";
import { BarChart3, ChevronDown, ChevronUp, ExternalLink, Pencil } from "lucide-react";

type AuthoredTaskRow = {
  id: string;
  slug: string;
  title: string;
  order: string;
  status: string;
  solvedCount: number;
  attemptCount: number;
  problemCount: number;
};

const DEFAULT_VISIBLE_TASKS = 5;

export function AuthoredTasksTable({
  rows,
  canManageContent,
  canViewAnalytics,
}: {
  rows: AuthoredTaskRow[];
  canManageContent: boolean;
  canViewAnalytics: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = Math.max(0, rows.length - DEFAULT_VISIBLE_TASKS);
  const visibleRows = expanded ? rows : rows.slice(0, DEFAULT_VISIBLE_TASKS);

  return (
    <div className="profile-authored-table-wrap">
      <table className="profile-authored-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Problems</th>
            <th># Solved</th>
            <th>Attempts</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((set) => (
            <tr key={set.id}>
              <td>
                <span className="profile-authored-id">{set.order}</span>
              </td>
              <td>
                <div className="profile-authored-name-cell">
                  <Link className="text-link" href={`/problem-sets/${set.slug}`}>
                    {set.title}
                  </Link>
                  <span className={`profile-authored-status ${set.status.toLowerCase()}`}>
                    {set.status.toLowerCase()}
                  </span>
                </div>
              </td>
              <td>{set.problemCount}</td>
              <td>{set.solvedCount}</td>
              <td>{set.attemptCount}</td>
              <td>
                <div className="profile-authored-actions">
                  <Link className="profile-authored-action" href={`/problem-sets/${set.slug}`}>
                    <ExternalLink size={14} />
                    Open
                  </Link>
                  {canViewAnalytics ? (
                    <Link
                      className="profile-authored-action"
                      href={`/admin/sets/${set.id}/analytics`}
                    >
                      <BarChart3 size={14} />
                      Analytics
                    </Link>
                  ) : null}
                  {canManageContent ? (
                    <Link className="profile-authored-action" href={`/admin/sets/${set.id}`}>
                      <Pencil size={14} />
                      Manage
                    </Link>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hiddenCount > 0 ? (
        <div className="profile-authored-expand-row">
          <button
            aria-expanded={expanded}
            className="profile-authored-expand"
            type="button"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? (
              <>
                <ChevronUp size={16} />
                Show fewer
              </>
            ) : (
              <>
                <ChevronDown size={16} />
                Show more ({hiddenCount} more)
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
