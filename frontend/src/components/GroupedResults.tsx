import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { GroupedResultGroup } from "../lib/api";
import { ResultCard } from "./ResultCard";
import { Badge } from "@/components/ui/Badge";

interface GroupedResultsProps {
  groups: GroupedResultGroup[];
}

export function GroupedResults({ groups }: GroupedResultsProps) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (groups.length > 0) {
      initial.add(groups[0].gesetz);
    }
    return initial;
  });

  if (groups.length === 0) {
    return (
      <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 py-4">
        Keine Ergebnisse in der gruppierten Ansicht.
      </p>
    );
  }

  const toggleGroup = (gesetz: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(gesetz)) {
        next.delete(gesetz);
      } else {
        next.add(gesetz);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const isOpen = openGroups.has(group.gesetz);
        return (
          <div key={group.gesetz}>
            <button
              onClick={() => toggleGroup(group.gesetz)}
              aria-expanded={isOpen}
              className="bg-neutral-50 dark:bg-neutral-800 px-4 py-3 w-full flex items-center justify-between rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-750 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  {group.gesetz}
                </span>
                <Badge variant="default">{group.total}</Badge>
              </div>
              {isOpen ? (
                <ChevronUp size={16} className="text-neutral-400" aria-hidden="true" />
              ) : (
                <ChevronDown size={16} className="text-neutral-400" aria-hidden="true" />
              )}
            </button>
            {isOpen && (
              <div role="region" aria-label={`Ergebnisse fuer ${group.gesetz}`}>
                <ul className="space-y-3 mt-2">
                  {group.results.map((result, i) => (
                    <li key={`${result.paragraph}-${result.gesetz}-${i}`}>
                      <ResultCard result={result} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
