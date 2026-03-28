import type { HopResultItem } from "@/lib/api";
import { HopBadge } from "./HopBadge";

interface HopResultCardProps {
  item: HopResultItem;
  onLookup?: (paragraph: string, gesetz: string) => void;
}

export function HopResultCard({ item, onLookup }: HopResultCardProps) {
  return (
    <article className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 shadow-sm">
      {/* Header: HopBadge + paragraph reference */}
      <div className="flex items-center gap-2">
        <HopBadge hop={item.hop} />
        <button
          onClick={() => onLookup?.(item.paragraph, item.gesetz)}
          className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          aria-label={`${item.paragraph} ${item.gesetz} nachschlagen`}
        >
          {item.paragraph} {item.gesetz}
        </button>
      </div>

      {/* Via-reference */}
      {item.via_reference && (
        <p className="mt-1 text-xs italic text-primary-600 dark:text-primary-400">
          via {item.via_reference}
        </p>
      )}

      {/* Title */}
      {item.titel && (
        <p className="mt-1 font-semibold text-subheading text-neutral-800 dark:text-neutral-200">
          {item.titel}
        </p>
      )}

      {/* Text (truncated to 3 lines) */}
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300 line-clamp-3">
        {item.text}
      </p>

      {/* Score */}
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        Score: {item.score.toFixed(2)}
      </p>
    </article>
  );
}
