"use client";

import { useMemo, useState } from "react";

type Suggestion = {
  label: string;
  value?: string;
  detail?: string;
};

type SearchSuggestInputProps = {
  suggestions: Suggestion[];
  ariaLabel: string;
  placeholder: string;
  className?: string;
  name?: string;
  type?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  submitOnSelect?: boolean;
};

function scoreSuggestion(suggestion: Suggestion, query: string) {
  const label = suggestion.label.toLowerCase();
  const value = (suggestion.value ?? suggestion.label).toLowerCase();
  const detail = suggestion.detail?.toLowerCase() ?? "";
  const haystack = `${label} ${value} ${detail}`.trim();

  if (value === query || label === query) return 1000;
  if (value.startsWith(query) || label.startsWith(query)) return 800 - Math.min(label.length, 200);
  if (detail.startsWith(query)) return 650 - Math.min(detail.length, 200);
  if (haystack.includes(query)) return 450 - haystack.indexOf(query);

  const queryParts = query.split(/\s+/).filter(Boolean);
  if (queryParts.length > 1 && queryParts.every((part) => haystack.includes(part))) {
    return 300 - haystack.length;
  }

  return -1;
}

function uniqueSuggestions(suggestions: Suggestion[]) {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = (suggestion.value ?? suggestion.label).trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function SearchSuggestInput({
  suggestions,
  ariaLabel,
  placeholder,
  className,
  name,
  type = "search",
  defaultValue = "",
  value,
  onValueChange,
  submitOnSelect = false,
}: SearchSuggestInputProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [focused, setFocused] = useState(false);
  const currentValue = value ?? internalValue;
  const trimmedQuery = currentValue.trim().toLowerCase();

  const rankedSuggestions = useMemo(() => {
    if (!trimmedQuery) return [];
    return uniqueSuggestions(suggestions)
      .map((suggestion) => ({
        suggestion,
        score: scoreSuggestion(suggestion, trimmedQuery),
      }))
      .filter((entry) => entry.score >= 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.suggestion.label.length - b.suggestion.label.length ||
          a.suggestion.label.localeCompare(b.suggestion.label),
      )
      .slice(0, 3)
      .map((entry) => entry.suggestion);
  }, [suggestions, trimmedQuery]);

  function setNextValue(nextValue: string) {
    if (value === undefined) {
      setInternalValue(nextValue);
    }
    onValueChange?.(nextValue);
  }

  function selectSuggestion(nextValue: string, target: EventTarget & HTMLButtonElement) {
    setNextValue(nextValue);
    setFocused(false);
    if (submitOnSelect) {
      requestAnimationFrame(() => target.form?.requestSubmit());
    }
  }

  return (
    <span className={["search-suggest-root", className].filter(Boolean).join(" ")}>
      <input
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        name={name}
        placeholder={placeholder}
        type={type}
        value={currentValue}
        onBlur={() => setFocused(false)}
        onChange={(event) => setNextValue(event.target.value)}
        onFocus={() => setFocused(true)}
      />
      {focused && rankedSuggestions.length > 0 ? (
        <span className="search-suggest-menu" role="listbox">
          {rankedSuggestions.map((suggestion) => {
            const suggestionValue = suggestion.value ?? suggestion.label;
            return (
              <button
                className="search-suggest-option"
                key={suggestionValue}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => selectSuggestion(suggestionValue, event.currentTarget)}
              >
                <span>{suggestion.label}</span>
                {suggestion.detail ? <small>{suggestion.detail}</small> : null}
              </button>
            );
          })}
        </span>
      ) : null}
    </span>
  );
}
