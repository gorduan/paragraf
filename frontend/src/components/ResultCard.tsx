import React, { useState, useContext } from "react";
import {
  ChevronDown,
  ChevronUp,
  Bookmark,
  BookmarkCheck,
  Copy,
  Check,
  GitCompare,
} from "lucide-react";
import { BookmarkContext } from "../App";
import type { SearchResultItem } from "../lib/api";

interface ResultCardProps {
  result: SearchResultItem;
  onCompare?: (ref: string) => void;
  showScore?: boolean;
  defaultExpanded?: boolean;
}

export function ResultCard({
  result,
  onCompare,
  showScore = true,
  defaultExpanded = false,
}: ResultCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const { isBookmarked, addBookmark, removeBookmark } = useContext(BookmarkContext);

  const ref = `${result.paragraph} ${result.gesetz}`;
  const bookmarked = isBookmarked(ref);

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
            <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded-full" aria-hidden="true">
              {result.gesetz}
            </span>
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
            <button
              onClick={handleCopy}
              aria-label={copied ? "Text kopiert" : `${result.paragraph} ${result.gesetz} kopieren`}
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              <span aria-live="polite">{copied ? "Kopiert" : "Kopieren"}</span>
            </button>
            <button
              onClick={() =>
                bookmarked ? removeBookmark(ref) : addBookmark(ref)
              }
              aria-label={bookmarked ? `${ref} aus Lesezeichen entfernen` : `${ref} als Lesezeichen speichern`}
              aria-pressed={bookmarked}
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              {bookmarked ? (
                <BookmarkCheck size={14} className="text-primary-500" aria-hidden="true" />
              ) : (
                <Bookmark size={14} aria-hidden="true" />
              )}
              {bookmarked ? "Gespeichert" : "Merken"}
            </button>
            {onCompare && (
              <button
                onClick={() => onCompare(ref)}
                aria-label={`${ref} zum Vergleich hinzufuegen`}
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <GitCompare size={14} aria-hidden="true" />
                Vergleichen
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
