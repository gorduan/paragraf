import React, { useState, useContext } from "react";
import {
  ChevronRight,
  ChevronDown,
  Bookmark,
  BookmarkCheck,
  Check,
  GitCompare,
} from "lucide-react";
import { BookmarkContext } from "../App";
import { CompareContext } from "../App";
import type { SearchResultItem } from "../lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface MiniCardProps {
  result: SearchResultItem;
}

export function MiniCard({ result }: MiniCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { isBookmarked, addBookmark, removeBookmark } = useContext(BookmarkContext);
  const { isSelected, addItem, removeItem } = useContext(CompareContext);

  const ref = `${result.paragraph} ${result.gesetz}`;
  const bookmarked = isBookmarked(ref);
  const compareSelected = isSelected(ref);

  return (
    <article
      className="ml-8 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md p-2"
      aria-label={`${result.paragraph} ${result.gesetz}`}
    >
      {/* Header — clickable to toggle expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={`${result.paragraph} ${result.gesetz} ${expanded ? "zuklappen" : "aufklappen"}`}
        className="w-full flex items-center gap-2 text-left"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
        )}
        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
          {result.paragraph} {result.gesetz}
        </span>
        <Badge variant="default">
          <span className="text-xs">Score: {result.score.toFixed(2)}</span>
        </Badge>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-2">
          <pre className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap font-sans leading-relaxed px-2 py-2">
            {result.text}
          </pre>

          {/* Action bar */}
          <div className="flex items-center gap-1 pt-2" role="toolbar" aria-label="Aktionen">
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
          </div>
        </div>
      )}
    </article>
  );
}
