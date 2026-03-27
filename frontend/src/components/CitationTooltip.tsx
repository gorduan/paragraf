import React, { useState, useRef, useCallback } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { api, type ReferenceItem, type ReferenceNetworkResponse } from "../lib/api";
import { parseCitations } from "../lib/citation-parser";
import { CitationLink } from "./CitationLink";

interface CitationTooltipProps {
  reference: ReferenceItem;
  onNavigate: (gesetz: string, paragraph: string) => void;
  depth?: number;
}

export function CitationTooltip({ reference, onNavigate, depth = 0 }: CitationTooltipProps) {
  const [data, setData] = useState<ReferenceNetworkResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const cacheRef = useRef<ReferenceNetworkResponse | null>(null);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open || !reference.verified) return;
      if (cacheRef.current) {
        setData(cacheRef.current);
        return;
      }
      setLoading(true);
      setFetchError(false);
      api
        .references(reference.gesetz, reference.paragraph)
        .then((res) => {
          cacheRef.current = res;
          setData(res);
        })
        .catch(() => setFetchError(true))
        .finally(() => setLoading(false));
    },
    [reference]
  );

  // Build excerpt text from reference network data
  const getExcerpt = (): string => {
    if (!data) return "";
    // Prefer first incoming text_preview, fallback to empty
    if (data.incoming.length > 0) {
      return data.incoming[0].text_preview.slice(0, 150);
    }
    return "";
  };

  // Get outgoing references for nested citation rendering
  const getOutgoingRefs = (): ReferenceItem[] => {
    if (!data) return [];
    return data.outgoing;
  };

  const renderExcerpt = () => {
    const excerpt = getExcerpt();
    if (!excerpt) return null;

    // Only render nested citations at depth < 1
    if (depth < 1) {
      const segments = parseCitations(excerpt, getOutgoingRefs());
      return (
        <span>
          {segments.map((seg, i) =>
            seg.type === "text" ? (
              <span key={i}>{seg.content}</span>
            ) : (
              <CitationLink
                key={i}
                reference={seg.reference!}
                onNavigate={onNavigate}
                depth={depth + 1}
              />
            )
          )}
        </span>
      );
    }

    // At depth >= 1, render as plain text (no further nesting)
    return <span>{excerpt}</span>;
  };

  return (
    <Tooltip.Provider>
      <Tooltip.Root delayDuration={300} onOpenChange={handleOpenChange}>
        <Tooltip.Trigger asChild>
          <span>
            <CitationLink
              reference={reference}
              onNavigate={onNavigate}
              depth={depth}
            />
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={4}
            className="z-50 max-w-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm shadow-lg"
          >
            {!reference.verified ? (
              <p className="text-warning-500">Dieses Gesetz ist nicht indexiert.</p>
            ) : loading ? (
              <p className="text-slate-400">Laden...</p>
            ) : fetchError ? (
              <p className="text-error-500">Fehler beim Laden.</p>
            ) : (
              <div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {renderExcerpt() || (
                    <span className="text-slate-400">Keine Vorschau verfuegbar.</span>
                  )}
                </p>
                <button
                  onClick={() => onNavigate(reference.gesetz, reference.paragraph)}
                  className="mt-1 text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
                >
                  Mehr lesen
                </button>
              </div>
            )}
            <Tooltip.Arrow className="fill-white dark:fill-slate-800" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
