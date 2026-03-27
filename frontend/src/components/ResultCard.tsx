import React, { useState, useContext } from "react";
import {
  ChevronDown,
  ChevronUp,
  Bookmark,
  BookmarkCheck,
  Copy,
  Check,
  GitCompare,
  Sparkles,
  Network,
} from "lucide-react";
import { BookmarkContext, CompareContext } from "../App";
import type { SearchResultItem } from "../lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RecommendSection } from "./RecommendSection";

interface ResultCardProps {
  result: SearchResultItem;
  onCompare?: (ref: string) => void;
  onGraphNavigate?: (gesetz: string, paragraph: string) => void;
  showScore?: boolean;
  defaultExpanded?: boolean;
}

export function ResultCard({
  result,
  onCompare,
  onGraphNavigate,
  showScore = true,
  defaultExpanded = false,
}: ResultCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const [showRecommend, setShowRecommend] = useState(false);
  const { isBookmarked, addBookmark, removeBookmark } = useContext(BookmarkContext);
  const { isSelected, addItem, removeItem } = useContext(CompareContext);

  const ref = `${result.paragraph} ${result.gesetz}`;
  const bookmarked = isBookmarked(ref);
  const compareSelected = isSelected(ref);

  const handleCopy = async () => {
    const text = `${result.paragraph} ${result.gesetz}${
      result.titel ? ` - ${result.titel}` : ""
    }\n\n${result.text}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article
      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
      aria-label={`${result.paragraph} ${result.gesetz}${result.titel ? ` – ${result.titel}` : ""}`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={`${result.paragraph} ${result.gesetz}${result.titel ? ` – ${result.titel}` : ""} ${expanded ? "zuklappen" : "aufklappen"}`}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
      >
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
              {result.paragraph} {result.gesetz}
            </span>
            <Badge variant="primary" aria-hidden="true">
              {result.gesetz}
            </Badge>
            {showScore && (
              <span className="text-xs text-slate-400" aria-label={`Relevanz-Score: ${result.score.toFixed(2)}`}>
                Score: {result.score.toFixed(2)}
              </span>
            )}
          </div>
          {result.titel && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {result.titel}
            </p>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-slate-400" aria-hidden="true" />
        ) : (
          <ChevronDown size={16} className="text-slate-400" aria-hidden="true" />
        )}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-slate-200 dark:border-slate-700">
          <div className="px-4 py-3">
            <pre className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
              {result.text}
            </pre>

            {/* Metadata */}
            {result.hierarchie_pfad && (
              <p className="mt-3 text-xs text-slate-400">
                {result.hierarchie_pfad}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 px-3 py-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50" role="toolbar" aria-label="Aktionen">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              aria-label={copied ? "Text kopiert" : `${result.paragraph} ${result.gesetz} kopieren`}
              className="gap-1"
            >
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              <span aria-live="polite">{copied ? "Kopiert" : "Kopieren"}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                bookmarked ? removeBookmark(ref) : addBookmark(ref)
              }
              aria-label={bookmarked ? `${ref} aus Lesezeichen entfernen` : `${ref} als Lesezeichen speichern`}
              aria-pressed={bookmarked}
              className="gap-1"
            >
              {bookmarked ? (
                <BookmarkCheck size={14} className="text-primary-500" aria-hidden="true" />
              ) : (
                <Bookmark size={14} aria-hidden="true" />
              )}
              {bookmarked ? "Gespeichert" : "Merken"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRecommend(!showRecommend)}
              aria-expanded={showRecommend}
              aria-label={showRecommend ? "Aehnliche Paragraphen ausblenden" : "Aehnliche Paragraphen anzeigen"}
              className="gap-1"
            >
              <Sparkles size={14} aria-hidden="true" />
              Aehnliche finden
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => compareSelected ? removeItem(ref) : addItem(ref)}
              aria-label={compareSelected ? `${ref} aus Vergleich entfernen` : `${ref} zum Vergleich hinzufuegen`}
              aria-pressed={compareSelected}
              className={`gap-1 ${compareSelected ? "text-primary-500" : ""}`}
            >
              {compareSelected ? (
                <Check size={14} className="text-primary-500" aria-hidden="true" />
              ) : (
                <GitCompare size={14} aria-hidden="true" />
              )}
              {compareSelected ? "Ausgewaehlt" : "Vergleichen"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onGraphNavigate?.(result.gesetz, result.paragraph)}
              aria-label={`Zitationen fuer ${result.paragraph} ${result.gesetz}`}
              className="gap-1"
            >
              <Network size={14} aria-hidden="true" />
              Zitationen
            </Button>
          </div>

          {/* Recommend Section */}
          {showRecommend && (
            <div className="motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out">
              <RecommendSection paragraph={result.paragraph} gesetz={result.gesetz} />
            </div>
          )}
        </div>
      )}
    </article>
  );
}
