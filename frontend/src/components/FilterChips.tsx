import { X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { FilterValues } from "@/components/FilterPanel";

interface FilterChipsProps {
  filters: FilterValues;
  onRemove: (key: keyof FilterValues) => void;
  onClearAll: () => void;
}

export function FilterChips({ filters, onRemove, onClearAll }: FilterChipsProps) {
  const hasAbschnitt = filters.abschnitt !== null && filters.abschnitt !== "";
  const hasChunkTyp = filters.chunk_typ !== null;
  const hasAbsatzRange = filters.absatz_von !== null || filters.absatz_bis !== null;

  const hasAny = hasAbschnitt || hasChunkTyp || hasAbsatzRange;

  if (!hasAny) return null;

  const handleRemoveAbsatzRange = () => {
    onRemove("absatz_von");
    onRemove("absatz_bis");
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {hasAbschnitt && (
        <Badge variant="primary" className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5">
          Abschnitt: {filters.abschnitt}
          <button
            onClick={() => onRemove("abschnitt")}
            aria-label="Filter entfernen: Abschnitt"
            className="ml-0.5 rounded-sm hover:bg-primary-200 dark:hover:bg-primary-700 p-0.5"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </Badge>
      )}

      {hasChunkTyp && (
        <Badge variant="primary" className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5">
          Typ: {filters.chunk_typ}
          <button
            onClick={() => onRemove("chunk_typ")}
            aria-label="Filter entfernen: Chunk-Typ"
            className="ml-0.5 rounded-sm hover:bg-primary-200 dark:hover:bg-primary-700 p-0.5"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </Badge>
      )}

      {hasAbsatzRange && (
        <Badge variant="primary" className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5">
          Absatz {filters.absatz_von ?? "..."}&ndash;{filters.absatz_bis ?? "..."}
          <button
            onClick={handleRemoveAbsatzRange}
            aria-label="Filter entfernen: Absatz-Bereich"
            className="ml-0.5 rounded-sm hover:bg-primary-200 dark:hover:bg-primary-700 p-0.5"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </Badge>
      )}

      <button
        onClick={onClearAll}
        className="text-sm text-error-500 hover:underline"
      >
        Alle zuruecksetzen
      </button>
    </div>
  );
}
