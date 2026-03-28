import type { HopResultItem } from "@/lib/api";
import { HopResultCard } from "./HopResultCard";

interface HopResultListProps {
  results: HopResultItem[];
  visitedCount: number;
  expandedTerms: string[];
  onLookup?: (paragraph: string, gesetz: string) => void;
}

export function HopResultList({ results, visitedCount, expandedTerms, onLookup }: HopResultListProps) {
  if (results.length === 0) {
    return (
      <div className="mt-8 text-center text-neutral-500 dark:text-neutral-400" role="status">
        <p className="text-lg font-semibold">Keine Ergebnisse</p>
        <p className="text-body mt-1">
          Die Verweissuche hat keine Treffer ergeben. Versuchen Sie einen allgemeineren Suchbegriff oder erhoehen Sie die Suchtiefe.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ul role="list" aria-label="Suchergebnisse der Verweissuche" className="space-y-3">
        {results.map((item, i) => (
          <li key={`${item.paragraph}-${item.gesetz}-${item.hop}-${i}`} role="listitem">
            <HopResultCard item={item} onLookup={onLookup} />
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className="border-t border-neutral-200 dark:border-neutral-700 pt-3 mt-4">
        <p className="text-xs text-neutral-500">
          {visitedCount} Paragraphen durchsucht
        </p>
        {expandedTerms.length > 0 && (
          <p className="text-xs text-neutral-500 mt-1">
            Erweitert:{" "}
            {expandedTerms.map((term, i) => (
              <span
                key={i}
                className="inline-block bg-neutral-100 dark:bg-neutral-700 rounded px-2 py-0.5 text-xs mr-1 mb-1"
              >
                {term}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}
