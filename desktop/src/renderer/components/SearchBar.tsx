import React, { useState, useEffect, useRef } from "react";

import { Search, X, ChevronDown } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string, gesetzbuch?: string) => void;
  placeholder?: string;
  showFilter?: boolean;
  autoFocus?: boolean;
}

const GESETZE = [
  "Alle Gesetze",
  "SGB I", "SGB II", "SGB III", "SGB IV", "SGB V", "SGB VI", "SGB VII",
  "SGB VIII", "SGB IX", "SGB X", "SGB XI", "SGB XII", "SGB XIV",
  "BGG", "AGG", "VersMedV", "EStG", "KraftStG",
];

export function SearchBar({
  onSearch,
  placeholder = "Suchbegriff eingeben...",
  showFilter = true,
  autoFocus = false,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Alle Gesetze");
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("paragraf_search_history") || "[]");
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const doSearch = (q: string) => {
    if (!q.trim()) return;
    const gb = filter === "Alle Gesetze" ? undefined : filter;
    onSearch(q.trim(), gb);
    // Add to history
    const newHistory = [q.trim(), ...history.filter((h) => h !== q.trim())].slice(0, 20);
    setHistory(newHistory);
    localStorage.setItem("paragraf_search_history", JSON.stringify(newHistory));
    setShowHistory(false);
  };

  const handleChange = (value: string) => {
    setQuery(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      doSearch(query);
    } else if (e.key === "Escape") {
      setQuery("");
      setShowHistory(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => history.length > 0 && setShowHistory(true)}
            onBlur={() => setTimeout(() => setShowHistory(false), 200)}
            placeholder={placeholder}
            className="w-full pl-10 pr-10 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          )}

          {/* History Dropdown */}
          {showHistory && history.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-auto">
              {history.map((item, i) => (
                <button
                  key={i}
                  onMouseDown={() => {
                    setQuery(item);
                    doSearch(item);
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>

        {showFilter && (
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="appearance-none h-full pl-3 pr-8 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
            >
              {GESETZE.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>
        )}

        <button
          onClick={() => doSearch(query)}
          className="px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Suchen
        </button>
      </div>
    </div>
  );
}
