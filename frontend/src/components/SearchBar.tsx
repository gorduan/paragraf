import React, { useState, useEffect, useRef } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { api, type LawInfo } from "../lib/api";
import { Button } from "@/components/ui/Button";
import { SearchModeToggle } from "./SearchModeToggle";

interface SearchBarProps {
  onSearch: (query: string, gesetzbuch?: string, searchType?: "semantic" | "fulltext" | "hybrid_fulltext" | "multi_hop") => void;
  placeholder?: string;
  showFilter?: boolean;
  autoFocus?: boolean;
  isDiscoveryMode?: boolean;
  onDiscoveryToggle?: (active: boolean) => void;
}

export function SearchBar({
  onSearch,
  placeholder = "Suchbegriff eingeben...",
  showFilter = true,
  autoFocus = false,
  isDiscoveryMode = false,
  onDiscoveryToggle,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Alle Gesetze");
  const [laws, setLaws] = useState<LawInfo[]>([]);
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("paragraf_search_history") || "[]");
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState(false);
  const [searchMode, setSearchMode] = useState<"semantic" | "fulltext" | "hybrid_fulltext" | "multi_hop">("semantic");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    api.laws().then((res) => setLaws(res.gesetze)).catch(() => {});
  }, []);

  // Group laws by rechtsgebiet
  const groupedLaws = laws.reduce<Record<string, LawInfo[]>>((acc, law) => {
    const group = law.rechtsgebiet || "Sonstiges";
    if (!acc[group]) acc[group] = [];
    acc[group].push(law);
    return acc;
  }, {});

  const doSearch = (q: string) => {
    if (!q.trim()) return;
    const gb = filter === "Alle Gesetze" ? undefined : filter;
    onSearch(q.trim(), gb, searchMode);
    // Add to history
    const newHistory = [q.trim(), ...history.filter((h) => h !== q.trim())].slice(0, 20);
    setHistory(newHistory);
    localStorage.setItem("paragraf_search_history", JSON.stringify(newHistory));
    setShowHistory(false);
  };

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
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
    <search className="relative" role="search" aria-label="Gesetzessuche">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <label htmlFor="search-input" className="sr-only">Suchbegriff</label>
          <input
            id="search-input"
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => history.length > 0 && setShowHistory(true)}
            onBlur={() => setTimeout(() => setShowHistory(false), 200)}
            placeholder={placeholder}
            aria-autocomplete="list"
            aria-expanded={showHistory && history.length > 0}
            aria-controls="search-history"
            className="w-full pl-10 pr-10 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Suchfeld leeren"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}

          {/* History Dropdown */}
          {showHistory && history.length > 0 && (
            <ul
              id="search-history"
              role="listbox"
              aria-label="Suchverlauf"
              className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-auto"
            >
              {history.map((item, i) => (
                <li key={i} role="option" aria-selected={false}>
                  <button
                    onMouseDown={() => {
                      setQuery(item);
                      doSearch(item);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {showFilter && (
          <div className="relative">
            <label htmlFor="law-filter" className="sr-only">Gesetz filtern</label>
            <select
              id="law-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="appearance-none h-full pl-3 pr-8 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
            >
              <option value="Alle Gesetze">Alle Gesetze</option>
              {Object.entries(groupedLaws).map(([group, groupLaws]) => (
                <optgroup key={group} label={group}>
                  {groupLaws.map((law) => (
                    <option key={law.abkuerzung} value={law.abkuerzung}>
                      {law.abkuerzung}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              aria-hidden="true"
            />
          </div>
        )}

        <Button onClick={() => doSearch(query)} size="lg">
          Suche starten
        </Button>
      </div>
      <SearchModeToggle value={searchMode} onChange={setSearchMode} isDiscoveryMode={isDiscoveryMode} onDiscoveryToggle={onDiscoveryToggle} />
    </search>
  );
}
