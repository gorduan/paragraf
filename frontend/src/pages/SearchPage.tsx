import React, { useState, useContext, useCallback } from "react";
import { SearchBar } from "../components/SearchBar";
import { ResultCard } from "../components/ResultCard";
import { Disclaimer } from "../components/Disclaimer";
import { FilterPanel, type FilterValues } from "../components/FilterPanel";
import { FilterChips } from "../components/FilterChips";
import { ViewToggle, type ViewMode } from "../components/ViewToggle";
import { GroupedResults } from "../components/GroupedResults";
import { LoadMoreButton } from "../components/LoadMoreButton";
import { DiscoveryExampleBar, type DiscoveryExample } from "../components/DiscoveryExampleBar";
import { UndoSnackbar } from "../components/UndoSnackbar";
import { CompareContext } from "../App";
import { api, type SearchResultItem, type GroupedResultGroup } from "../lib/api";
import { Loader, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export function SearchPage() {
  // Search results
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [groupedResults, setGroupedResults] = useState<GroupedResultGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [total, setTotal] = useState(0);

  // Pagination
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // View mode (per D-07 -- localStorage persisted)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem("paragraf_view_mode");
      return (saved === "liste" || saved === "gruppiert") ? saved : "liste";
    } catch { return "liste"; }
  });

  // Filters
  const [filters, setFilters] = useState<FilterValues>({
    abschnitt: null, chunk_typ: null, absatz_von: null, absatz_bis: null,
  });

  // Search mode
  const [searchMode, setSearchMode] = useState<"semantic" | "fulltext" | "hybrid_fulltext">("semantic");

  // Expanded terms
  const [expandedTerms, setExpandedTerms] = useState<string[]>([]);

  // Gesetzbuch filter from SearchBar
  const [currentGesetzbuch, setCurrentGesetzbuch] = useState<string | undefined>(undefined);

  // Compare context
  const { items: compareItems } = useContext(CompareContext);

  // ── Discovery state (per D-11, D-12, D-13, D-14) ──────────────────────────
  const [isDiscoveryMode, setIsDiscoveryMode] = useState(false);
  const [discoveryExamples, setDiscoveryExamples] = useState<DiscoveryExample[]>([]);
  const [previousResults, setPreviousResults] = useState<SearchResultItem[] | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<{
    examples: DiscoveryExample[];
    results: SearchResultItem[];
  } | null>(null);
  const [showUndo, setShowUndo] = useState(false);

  // ── Core search logic ────────────────────────────────────────────────────

  const executeSearch = useCallback(async (
    q: string,
    mode: "semantic" | "fulltext" | "hybrid_fulltext",
    filterValues: FilterValues,
    gesetzbuch?: string,
  ) => {
    setLoading(true);
    setError(null);
    setResults([]);
    setGroupedResults([]);
    setNextCursor(null);
    setExpandedTerms([]);

    try {
      if (viewMode === "gruppiert") {
        const res = await api.searchGrouped({
          anfrage: q,
          gesetzbuch: gesetzbuch || null,
          search_type: mode,
          group_size: 3,
          max_groups: 10,
        });
        setGroupedResults(res.groups);
        setTotal(res.groups.reduce((sum, g) => sum + g.total, 0));
      } else {
        const res = await api.search({
          anfrage: q,
          gesetzbuch: gesetzbuch || null,
          search_type: mode,
          abschnitt: filterValues.abschnitt,
          chunk_typ: filterValues.chunk_typ,
          absatz_von: filterValues.absatz_von,
          absatz_bis: filterValues.absatz_bis,
          page_size: 10,
        });
        setResults(res.results);
        setTotal(res.total);
        setNextCursor(res.next_cursor || null);
        setExpandedTerms(res.expanded_terms || []);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Suche fehlgeschlagen";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [viewMode]);

  // ── Fetch grouped helper ─────────────────────────────────────────────────

  const fetchGrouped = useCallback(async (
    q: string,
    mode: "semantic" | "fulltext" | "hybrid_fulltext",
    gesetzbuch?: string,
  ) => {
    setLoading(true);
    setError(null);
    setResults([]);
    setGroupedResults([]);
    try {
      const res = await api.searchGrouped({
        anfrage: q,
        gesetzbuch: gesetzbuch || null,
        search_type: mode,
        group_size: 3,
        max_groups: 10,
      });
      setGroupedResults(res.groups);
      setTotal(res.groups.reduce((sum, g) => sum + g.total, 0));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Gruppierte Suche fehlgeschlagen";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── View mode persistence ────────────────────────────────────────────────

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("paragraf_view_mode", mode);
    if (mode === "gruppiert" && query) {
      fetchGrouped(query, searchMode, currentGesetzbuch);
    } else if (mode === "liste" && query) {
      executeSearch(query, searchMode, filters, currentGesetzbuch);
    }
  }, [query, searchMode, currentGesetzbuch, filters, fetchGrouped, executeSearch]);

  // ── Search handler (called by SearchBar) ─────────────────────────────────

  const handleSearch = async (
    q: string,
    gesetzbuch?: string,
    searchType?: "semantic" | "fulltext" | "hybrid_fulltext",
  ) => {
    const mode = searchType || searchMode;
    setSearchMode(mode);
    setQuery(q);
    setCurrentGesetzbuch(gesetzbuch);
    await executeSearch(q, mode, filters, gesetzbuch);
  };

  // ── Load more handler (per D-12) ────────────────────────────────────────

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.search({
        anfrage: query,
        gesetzbuch: currentGesetzbuch || null,
        search_type: searchMode,
        abschnitt: filters.abschnitt,
        chunk_typ: filters.chunk_typ,
        absatz_von: filters.absatz_von,
        absatz_bis: filters.absatz_bis,
        cursor: nextCursor,
        page_size: 10,
      });
      setResults((prev) => [...prev, ...res.results]);
      setTotal(res.total);
      setNextCursor(res.next_cursor || null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Weitere Ergebnisse konnten nicht geladen werden";
      setError(message);
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Filter handlers ──────────────────────────────────────────────────────

  const handleFilterApply = (newFilters: FilterValues) => {
    setFilters(newFilters);
    if (query) {
      executeSearch(query, searchMode, newFilters, currentGesetzbuch);
    }
  };

  const handleFilterRemove = (key: keyof FilterValues) => {
    const newFilters = { ...filters, [key]: null };
    if (key === "absatz_von" || key === "absatz_bis") {
      newFilters.absatz_von = null;
      newFilters.absatz_bis = null;
    }
    setFilters(newFilters);
    if (query) executeSearch(query, searchMode, newFilters, currentGesetzbuch);
  };

  const handleFilterClearAll = () => {
    const empty: FilterValues = { abschnitt: null, chunk_typ: null, absatz_von: null, absatz_bis: null };
    setFilters(empty);
    if (query) executeSearch(query, searchMode, empty, currentGesetzbuch);
  };

  // ── Discovery handlers (per D-11, D-12, D-13, D-14) ───────────────────────

  function handleDiscoveryToggle(active: boolean) {
    setIsDiscoveryMode(active);
    if (!active) {
      setDiscoveryExamples([]);
      if (previousResults) {
        setResults(previousResults);
        setPreviousResults(null);
      }
    }
  }

  function handleExampleToggle(gesetz: string, paragraph: string, polarity: "positive" | "negative" | null) {
    setDiscoveryExamples(prev => {
      const filtered = prev.filter(e => !(e.gesetz === gesetz && e.paragraph === paragraph));
      if (polarity === null) return filtered;
      // Enforce max 5 per polarity
      const samePolarity = filtered.filter(e => e.polarity === polarity);
      if (samePolarity.length >= 5) return prev;
      return [...filtered, { gesetz, paragraph, titel: "", polarity }];
    });
  }

  function handleRemoveExample(example: DiscoveryExample) {
    setDiscoveryExamples(prev =>
      prev.filter(e => !(e.gesetz === example.gesetz && e.paragraph === example.paragraph))
    );
  }

  async function handleExecuteDiscovery() {
    const positives = discoveryExamples.filter(e => e.polarity === "positive");
    if (positives.length === 0) return;
    setDiscoveryLoading(true);
    setError(null);
    const savedResults = results;
    try {
      const resp = await api.discover({
        positive_paragraphs: positives.map(e => ({ gesetz: e.gesetz, paragraph: e.paragraph })),
        negative_paragraphs: discoveryExamples
          .filter(e => e.polarity === "negative")
          .map(e => ({ gesetz: e.gesetz, paragraph: e.paragraph })),
        limit: 20,
      });
      setPreviousResults(savedResults);
      setResults(resp.results);
      setTotal(resp.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Entdeckungssuche fehlgeschlagen.";
      setError(message);
    } finally {
      setDiscoveryLoading(false);
    }
  }

  function handleDiscoveryReset() {
    setUndoSnapshot({ examples: [...discoveryExamples], results: results });
    setDiscoveryExamples([]);
    if (previousResults) {
      setResults(previousResults);
      setPreviousResults(null);
    }
    setShowUndo(true);
  }

  function handleUndo() {
    if (undoSnapshot) {
      setDiscoveryExamples(undoSnapshot.examples);
      setResults(undoSnapshot.results);
      setUndoSnapshot(null);
    }
    setShowUndo(false);
  }

  function handleUndoDismiss() {
    setShowUndo(false);
    setUndoSnapshot(null);
  }

  function getPolarity(gesetz: string, paragraph: string): "positive" | "negative" | null {
    const ex = discoveryExamples.find(e => e.gesetz === gesetz && e.paragraph === paragraph);
    return ex?.polarity ?? null;
  }

  // ── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-heading font-semibold mb-1">Suche</h1>
        <p className="text-body text-neutral-500 dark:text-slate-400">
          Semantische Suche ueber deutsche Gesetze
        </p>
      </div>

      {/* SearchBar (includes SearchModeToggle inside) */}
      <SearchBar
        onSearch={handleSearch}
        placeholder="z.B. 'Pflegegeld bei Pflegegrad 3' oder 'Zusatzurlaub Schwerbehinderung'"
        autoFocus
        isDiscoveryMode={isDiscoveryMode}
        onDiscoveryToggle={handleDiscoveryToggle}
      />

      {/* Filter Panel (per D-08 -- collapsible below SearchBar) */}
      <div className="mt-4">
        <FilterPanel onApply={handleFilterApply} initialValues={filters} />
      </div>

      {/* Active Filter Chips (per D-10) */}
      <div className="mt-2">
        <FilterChips filters={filters} onRemove={handleFilterRemove} onClearAll={handleFilterClearAll} />
      </div>

      {/* Discovery Example Bar (per D-13) */}
      {isDiscoveryMode && (
        <div className="mt-4">
          <DiscoveryExampleBar
            examples={discoveryExamples}
            onRemove={handleRemoveExample}
            onExecute={handleExecuteDiscovery}
            onReset={handleDiscoveryReset}
            loading={discoveryLoading}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
          <Loader className="animate-spin text-primary-500" size={24} aria-hidden="true" />
          <span className="ml-2 text-slate-500">Suche laeuft...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div role="alert" className="mt-4 p-4 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-md text-body text-error-700 dark:text-error-300">
          {error}
        </div>
      )}

      {/* Results Header: count + expanded terms + view toggle + compare counter */}
      {!loading && (results.length > 0 || groupedResults.length > 0) && (
        <div className="mt-6 flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-body text-slate-500 dark:text-slate-400" aria-live="polite">
              {viewMode === "liste" ? results.length : total} Ergebnisse fuer &quot;{query}&quot;
            </p>
            {expandedTerms.length > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                Erweitert: {expandedTerms.join(", ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Compare counter (per D-16) */}
            {compareItems.length > 0 && (
              <Badge variant="primary" className="cursor-pointer" aria-live="polite">
                {compareItems.length} zum Vergleich <ArrowRight size={12} className="inline ml-1" aria-hidden="true" />
              </Badge>
            )}
            <ViewToggle value={viewMode} onChange={handleViewModeChange} />
          </div>
        </div>
      )}

      {/* Results: Flat list view */}
      {!loading && viewMode === "liste" && results.length > 0 && (
        <section className="mt-4 space-y-3" aria-label="Suchergebnisse">
          <ul className="space-y-3" role="list">
            {results.map((r, i) => (
              <li key={`${r.paragraph}-${r.gesetz}-${i}`}>
                <ResultCard
                  result={r}
                  discoveryMode={isDiscoveryMode}
                  discoveryPolarity={getPolarity(r.gesetz, r.paragraph)}
                  onDiscoveryToggle={handleExampleToggle}
                />
              </li>
            ))}
          </ul>
          <LoadMoreButton
            loaded={results.length}
            total={total}
            loading={loadingMore}
            hasMore={nextCursor !== null}
            onLoadMore={handleLoadMore}
          />
          <Disclaimer />
        </section>
      )}

      {/* Results: Grouped view */}
      {!loading && viewMode === "gruppiert" && groupedResults.length > 0 && (
        <section className="mt-4" aria-label="Gruppierte Suchergebnisse">
          <GroupedResults groups={groupedResults} />
          <div className="mt-4">
            <Disclaimer />
          </div>
        </section>
      )}

      {/* Empty state */}
      {!loading && !error && results.length === 0 && groupedResults.length === 0 && query && (
        <div className="mt-8 text-center text-slate-400" role="status" aria-live="polite">
          <p className="text-lg font-semibold">Keine Ergebnisse</p>
          <p className="text-body mt-1">
            Fuer Ihre Suche wurden keine passenden Paragraphen gefunden. Versuchen Sie einen anderen Suchbegriff oder passen Sie die Filter an.
          </p>
        </div>
      )}

      {/* Initial state */}
      {!loading && !query && (
        <div className="mt-12 text-center text-slate-400">
          <p className="text-lg">Geben Sie einen Suchbegriff ein</p>
          <p className="text-sm mt-2">
            Tastenkuerzel: <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">Ctrl+K</kbd> fuer Suche
          </p>
        </div>
      )}

      {/* Undo Snackbar (per D-14) */}
      {showUndo && (
        <UndoSnackbar
          message="Beispiele entfernt"
          onUndo={handleUndo}
          onDismiss={handleUndoDismiss}
        />
      )}
    </div>
  );
}
