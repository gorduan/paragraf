import React, { useState } from "react";
import { SearchBar } from "../components/SearchBar";
import { ResultCard } from "../components/ResultCard";
import { Disclaimer } from "../components/Disclaimer";
import { api, type SearchResultItem } from "../lib/api";
import { Loader } from "lucide-react";

export function SearchPage() {
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const handleSearch = async (q: string, gesetzbuch?: string) => {
    setQuery(q);
    setLoading(true);
    setError(null);
    try {
      const res = await api.search({
        anfrage: q,
        gesetzbuch: gesetzbuch || null,
      });
      setResults(res.results);
    } catch (e: any) {
      setError(e.message || "Suche fehlgeschlagen");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Suche</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Semantische Suche über 18 deutsche Gesetze
        </p>
      </div>

      <SearchBar
        onSearch={handleSearch}
        placeholder="z.B. 'Pflegegeld bei Pflegegrad 3' oder 'Zusatzurlaub Schwerbehinderung'"
        autoFocus
      />

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader className="animate-spin text-primary-500" size={24} />
          <span className="ml-2 text-slate-500">Suche läuft...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {results.length} Ergebnisse für &quot;{query}&quot;
          </p>
          {results.map((r, i) => (
            <ResultCard key={`${r.paragraph}-${r.gesetz}-${i}`} result={r} />
          ))}
          <Disclaimer />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && results.length === 0 && query && (
        <div className="mt-8 text-center text-slate-400">
          <p>Keine Ergebnisse gefunden.</p>
          <p className="text-sm mt-1">
            Versuchen Sie eine allgemeinere Formulierung.
          </p>
        </div>
      )}

      {/* Initial state */}
      {!loading && !query && (
        <div className="mt-12 text-center text-slate-400">
          <p className="text-lg">Geben Sie einen Suchbegriff ein</p>
          <p className="text-sm mt-2">
            Tastenkürzel: <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">Ctrl+K</kbd> für Suche
          </p>
        </div>
      )}
    </div>
  );
}
