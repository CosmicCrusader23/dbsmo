"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ImagePlus, Send, Sigma } from "lucide-react";
import { Avatar } from "@/app/avatar";
import { MathCurveLoader } from "@/app/math-curve-loader";
import { LatexStatement } from "../latex-statement";

type WriteupPost = {
  id: string;
  title: string;
  body: string;
  contentFormat: "LATEX" | "HTML";
  createdAt: string;
  score: number;
  myVote: number;
  author: {
    id: string;
    email: string;
    name: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    image: string | null;
  };
  images: Array<{
    id: string;
    url: string;
    name: string;
  }>;
};

type WriteupsClientProps = {
  problemSetId: string;
  problemSetSlug: string;
  writeups: WriteupPost[];
};

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function WriteupsClient({ problemSetId, problemSetSlug, writeups }: WriteupsClientProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [contentFormat, setContentFormat] = useState<"LATEX" | "HTML">("LATEX");
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voteState, setVoteState] = useState(
    () =>
      new Map(
        writeups.map((writeup) => [writeup.id, { score: writeup.score, myVote: writeup.myVote }]),
      ),
  );

  async function submitWriteup(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData();
    formData.append("title", title);
    formData.append("body", body);
    formData.append("contentFormat", contentFormat);
    for (const image of images) {
      formData.append("images", image);
    }

    try {
      const response = await fetch(`/api/problem-sets/${problemSetId}/writeups`, {
        method: "POST",
        body: formData,
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Could not post writeup.");
        return;
      }
      setTitle("");
      setBody("");
      setImages([]);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  async function vote(writeupId: string, nextVote: number) {
    const current = voteState.get(writeupId) ?? { score: 0, myVote: 0 };
    const value = current.myVote === nextVote ? 0 : nextVote;
    setVoteState((state) => {
      const updated = new Map(state);
      updated.set(writeupId, {
        myVote: value,
        score: current.score - current.myVote + value,
      });
      return updated;
    });

    try {
      const response = await fetch(`/api/writeups/${writeupId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const result = (await response.json().catch(() => null)) as {
        score?: number;
        myVote?: number;
      } | null;
      if (response.ok && typeof result?.score === "number" && typeof result.myVote === "number") {
        const nextScore = result.score;
        const nextMyVote = result.myVote;
        setVoteState((state) => {
          const updated = new Map(state);
          updated.set(writeupId, { score: nextScore, myVote: nextMyVote });
          return updated;
        });
      }
    } catch {
      setVoteState((state) => {
        const updated = new Map(state);
        updated.set(writeupId, current);
        return updated;
      });
    }
  }

  return (
    <>
      <form className="writeup-composer" onSubmit={submitWriteup}>
        <div className="writeup-composer-head">
          <div>
            <p className="eyebrow">New post</p>
            <h2>Share a solution writeup</h2>
          </div>
          <div className="writeup-format-toggle" role="group" aria-label="Writeup format">
            <button
              type="button"
              className={contentFormat === "LATEX" ? "active" : ""}
              onClick={() => setContentFormat("LATEX")}
            >
              LaTeX
            </button>
            <button
              type="button"
              className={contentFormat === "HTML" ? "active" : ""}
              onClick={() => setContentFormat("HTML")}
            >
              HTML
            </button>
          </div>
        </div>
        <input
          className="form-input"
          maxLength={120}
          placeholder="Title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <textarea
          className="form-input writeup-body-input"
          maxLength={20000}
          placeholder="Write your solution. LaTeX like \\[x^2+y^2=1\\] works here."
          rows={6}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <div className="writeup-composer-actions">
          <label className="secondary-action compact writeup-image-picker">
            <ImagePlus size={16} />
            Images
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              onChange={(event) => setImages(Array.from(event.target.files ?? []).slice(0, 4))}
            />
          </label>
          {images.length > 0 ? (
            <span className="writeup-image-count">
              {images.length} image{images.length === 1 ? "" : "s"}
            </span>
          ) : null}
          {error ? <span className="form-error">{error}</span> : null}
          <button className="primary-action compact" type="submit" disabled={submitting}>
            {submitting ? (
              <MathCurveLoader size={16} label="Posting writeup" />
            ) : (
              <Send size={16} />
            )}
            Post
          </button>
        </div>
      </form>

      <section className="writeup-feed" aria-label="Writeups">
        {writeups.length === 0 ? (
          <div className="writeup-empty">
            <Sigma size={28} />
            <strong>No writeups yet</strong>
            <span>Be the first to post a solution idea for this set.</span>
          </div>
        ) : (
          writeups.map((writeup) => {
            const state = voteState.get(writeup.id) ?? {
              score: writeup.score,
              myVote: writeup.myVote,
            };
            const authorLabel = writeup.author.displayName || writeup.author.name || "Anonymous";
            return (
              <article className="writeup-post" key={writeup.id}>
                <div className="writeup-post-votes">
                  <button
                    type="button"
                    aria-label="Upvote writeup"
                    className={state.myVote === 1 ? "active" : ""}
                    onClick={() => void vote(writeup.id, 1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <strong>{state.score}</strong>
                  <button
                    type="button"
                    aria-label="Downvote writeup"
                    className={state.myVote === -1 ? "active" : ""}
                    onClick={() => void vote(writeup.id, -1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                </div>
                <div className="writeup-post-main">
                  <header className="writeup-post-header">
                    <Avatar user={writeup.author} size="sm" />
                    <div>
                      <div className="writeup-author-line">
                        <strong>{authorLabel}</strong>
                        <span>posted {timeAgo(writeup.createdAt)}</span>
                      </div>
                      <h3>{writeup.title}</h3>
                    </div>
                  </header>
                  {writeup.body ? (
                    <div className="writeup-rendered-body">
                      <LatexStatement statement={writeup.body} format={writeup.contentFormat} />
                    </div>
                  ) : null}
                  {writeup.images.length > 0 ? (
                    <div className="writeup-image-grid">
                      {writeup.images.map((image) => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={image.url} alt={image.name} key={image.id} />
                      ))}
                    </div>
                  ) : null}
                  <Link className="writeup-set-link" href={`/problem-sets/${problemSetSlug}`}>
                    Back to set
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </section>
    </>
  );
}
