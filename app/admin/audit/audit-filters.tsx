"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

type Option = { value: string; label: string };

export function AuditFilters({
  q,
  actionFilter,
  actorFilter,
  actionOptions,
  actorOptions,
}: {
  q: string;
  actionFilter: string;
  actorFilter: string;
  actionOptions: Option[];
  actorOptions: Option[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(q);

  function applyParam(name: string, value: string) {
    const sp = new URLSearchParams(searchParams?.toString() ?? "");
    if (value) sp.set(name, value);
    else sp.delete(name);
    router.push(`/admin/audit?${sp.toString()}`);
  }

  function submitQuery(e: React.FormEvent) {
    e.preventDefault();
    applyParam("q", query.trim());
  }

  function clearAll() {
    setQuery("");
    router.push("/admin/audit");
  }

  const hasFilter = q || actionFilter || actorFilter;

  return (
    <div className="audit-filters">
      <form className="audit-search" onSubmit={submitQuery}>
        <Search size={15} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search action, target type, or target id…"
          aria-label="Search events"
        />
      </form>
      <SearchableSelect
        placeholder="Action"
        options={actionOptions}
        value={actionFilter}
        onChange={(v) => applyParam("action", v)}
      />
      <SearchableSelect
        placeholder="Actor"
        options={actorOptions}
        value={actorFilter}
        onChange={(v) => applyParam("actor", v)}
      />
      {hasFilter ? (
        <button type="button" className="audit-clear" onClick={clearAll}>
          <X size={14} /> Clear
        </button>
      ) : null}
    </div>
  );
}

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.label.toLowerCase().includes(s));
  }, [query, options]);

  const current = options.find((o) => o.value === value);
  const label = current ? current.label : placeholder;

  return (
    <div
      className={`searchable-select${open ? " open" : ""}${value ? " has-value" : ""}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="searchable-select-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="searchable-select-label">{label}</span>
        <span className="searchable-select-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="searchable-select-menu">
          <input
            ref={inputRef}
            className="searchable-select-search"
            placeholder={`Search ${placeholder.toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="searchable-select-list" role="listbox">
            <li>
              <button
                type="button"
                className={`searchable-select-option${!value ? " active" : ""}`}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                All {placeholder.toLowerCase()}s
              </button>
            </li>
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  className={`searchable-select-option${o.value === value ? " active" : ""}`}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="searchable-select-empty">No matches</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
