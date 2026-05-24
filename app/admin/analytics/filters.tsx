"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Option = { value: string; label: string };

type Filter = {
  name: string;
  label: string;
  options: Option[];
  current: string;
};

export function AnalyticsFilters({
  filters,
  rangeKey,
  fromInitial,
  toInitial,
}: {
  filters: Filter[];
  rangeKey: string;
  fromInitial: string;
  toInitial: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(fromInitial);
  const [to, setTo] = useState(toInitial);

  function applyParam(name: string, value: string) {
    const sp = new URLSearchParams(searchParams?.toString() ?? "");
    if (value) sp.set(name, value);
    else sp.delete(name);
    if (rangeKey) sp.set("range", rangeKey);
    router.push(`/admin/analytics?${sp.toString()}`);
  }

  function clearAll() {
    router.push("/admin/analytics");
  }

  const hasFilter =
    filters.some((f) => f.current) || from || to;

  return (
    <div className="analytics-filter-bar">
      <div className="analytics-filter-row">
        {filters.map((f) => (
          <SearchableSelect
            key={f.name}
            placeholder={f.label}
            options={f.options}
            value={f.current}
            onChange={(v) => applyParam(f.name, v)}
          />
        ))}
        <input
          aria-label="From date"
          type="date"
          className="analytics-filter-input"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          onBlur={() => from !== fromInitial && applyParam("from", from)}
        />
        <input
          aria-label="To date"
          type="date"
          className="analytics-filter-input"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          onBlur={() => to !== toInitial && applyParam("to", to)}
        />
        {hasFilter ? (
          <button type="button" className="analytics-filter-clear" onClick={clearAll}>
            Clear
          </button>
        ) : null}
      </div>
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
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [query, options]);

  const current = options.find((o) => o.value === value);
  const displayLabel = current ? current.label : placeholder;

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
        <span className="searchable-select-label">{displayLabel}</span>
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
                All {placeholder.toLowerCase()}
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
