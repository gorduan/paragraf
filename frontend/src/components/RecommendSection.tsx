import React, { useState, useEffect } from "react";
import { Loader } from "lucide-react";
import { api } from "../lib/api";
import type { SearchResultItem } from "../lib/api";
import { MiniCard } from "./MiniCard";
import { Button } from "@/components/ui/Button";

interface RecommendSectionProps {
  paragraph: string;
  gesetz: string;
}

export function RecommendSection({ paragraph, gesetz }: RecommendSectionProps) {
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchRecommendations() {
      setLoading(true);
      setError(null);
      try {
        const response = await api.recommend({ paragraph, gesetz, limit: 10 });
        if (!cancelled) {
          setResults(response.results);
        }
      } catch (e) {
        if (!cancelled) {
          setError("Empfehlungen konnten nicht geladen werden. Bitte versuchen Sie es erneut.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchRecommendations();
    return () => { cancelled = true; };
  }, [paragraph, gesetz]);

  const visibleResults = results.slice(0, showAll ? results.length : 3);

  return (
    <div
      role="region"
      aria-label={`Aehnliche Paragraphen zu ${paragraph} ${gesetz}`}
      className="space-y-2 py-2 px-4"
    >
      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500" role="status">
          <Loader className="animate-spin text-primary-500" size={16} aria-hidden="true" />
          <span>Lade Empfehlungen...</span>
        </div>
      )}

      {error && (
        <p className="text-sm text-error-500" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && results.length === 0 && (
        <p className="text-sm text-slate-500">
          Keine aehnlichen Paragraphen gefunden.
        </p>
      )}

      {!loading && !error && visibleResults.map((result, index) => (
        <MiniCard key={`${result.paragraph}-${result.gesetz}-${index}`} result={result} />
      ))}

      {!loading && !error && results.length > 3 && !showAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll(true)}
          className="ml-8"
        >
          Weitere anzeigen ({results.length - 3} mehr)
        </Button>
      )}
    </div>
  );
}
