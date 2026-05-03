"use client";

import { useState } from "react";
import { CheckCircle2, RotateCcw, Trash2, XCircle } from "lucide-react";

type Report = {
  id: string;
  type: string;
  message: string;
  status: string;
  adminNote: string | null;
  createdAt: Date;
  user: { name: string | null; email: string };
  problemSet: { title: string; slug: string; id?: string };
  problem: { number: number; answerKey: string } | null;
};

export function FeedbackTable({ initialReports }: { initialReports: Report[] }) {
  const [reports, setReports] = useState(initialReports);
  const [updating, setUpdating] = useState<string | null>(null);

  async function handleUpdateStatus(id: string, status: string) {
    setUpdating(id);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      }
    } finally {
      setUpdating(null);
    }
  }

  async function handleDelete(id: string) {
    setUpdating(id);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setReports((prev) => prev.filter((report) => report.id !== id));
      }
    } finally {
      setUpdating(null);
    }
  }

  if (reports.length === 0) {
    return <div className="empty-state">No feedback reports found.</div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Student</th>
            <th>Set & Problem</th>
            <th>Type & Message</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.id}>
              <td>{new Date(report.createdAt).toLocaleDateString()}</td>
              <td>
                {report.user.name || "Unknown"}
                <br />
                <small className="text-muted">{report.user.email}</small>
              </td>
              <td>
                <strong>{report.problemSet.title}</strong>
                <br />
                <small className="text-muted">
                  {report.problem ? `Problem ${report.problem.number}` : "Overall Set"}
                </small>
                {report.problem && (
                  <div className="text-xs mt-1">Key: {report.problem.answerKey}</div>
                )}
              </td>
              <td>
                <span className="badge">{report.type.replace(/_/g, " ")}</span>
                <p className="mt-1 text-sm">{report.message}</p>
              </td>
              <td>
                <span className={`status-badge status-${report.status.toLowerCase()}`}>
                  {report.status}
                </span>
              </td>
              <td>
                <div className="flex-actions">
                  {report.status !== "RESOLVED" && (
                    <button
                      className="icon-button"
                      title="Resolve"
                      disabled={updating === report.id}
                      onClick={() => handleUpdateStatus(report.id, "RESOLVED")}
                    >
                      <CheckCircle2 size={16} className="correct-icon" />
                    </button>
                  )}
                  {report.status !== "REJECTED" && (
                    <button
                      className="icon-button"
                      title="Reject"
                      disabled={updating === report.id}
                      onClick={() => handleUpdateStatus(report.id, "REJECTED")}
                    >
                      <XCircle size={16} className="incorrect-icon" />
                    </button>
                  )}
                  {report.status !== "OPEN" && report.status !== "REVIEWING" && (
                    <>
                      <button
                        className="icon-button"
                        title="Reopen"
                        disabled={updating === report.id}
                        onClick={() => handleUpdateStatus(report.id, "OPEN")}
                      >
                        <RotateCcw size={16} />
                      </button>
                      <button
                        className="icon-button"
                        title="Delete"
                        disabled={updating === report.id}
                        onClick={() => handleDelete(report.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
