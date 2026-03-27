import { useState, useRef, useEffect } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export interface FilterValues {
  abschnitt: string | null;
  chunk_typ: string | null;
  absatz_von: number | null;
  absatz_bis: number | null;
}

interface FilterPanelProps {
  onApply: (filters: FilterValues) => void;
  initialValues?: FilterValues;
}

const DEFAULT_FILTERS: FilterValues = {
  abschnitt: null,
  chunk_typ: null,
  absatz_von: null,
  absatz_bis: null,
};

export function FilterPanel({ onApply, initialValues }: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<FilterValues>(initialValues ?? DEFAULT_FILTERS);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [open, local]);

  useEffect(() => {
    if (initialValues) {
      setLocal(initialValues);
    }
  }, [initialValues]);

  const handleApply = () => {
    onApply(local);
  };

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        Erweiterte Filter
      </button>

      <div
        style={{
          maxHeight: open ? `${contentHeight}px` : "0px",
          overflow: "hidden",
          transition: "max-height 200ms ease-in-out",
        }}
        className={cn(
          "motion-reduce:transition-none"
        )}
      >
        <div
          ref={contentRef}
          className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 mt-2 space-y-4"
        >
          {/* Abschnitt */}
          <div>
            <label
              htmlFor="filter-abschnitt"
              className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1"
            >
              Abschnitt
            </label>
            <Input
              id="filter-abschnitt"
              type="text"
              placeholder="z.B. Teil 1, Kapitel 2"
              value={local.abschnitt ?? ""}
              onChange={(e) =>
                setLocal((prev) => ({
                  ...prev,
                  abschnitt: e.target.value || null,
                }))
              }
              className="h-8"
            />
          </div>

          {/* Chunk-Typ */}
          <fieldset>
            <legend className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Chunk-Typ
            </legend>
            <div className="flex gap-4">
              {([
                { value: null, label: "Alle" },
                { value: "paragraph", label: "Paragraph" },
                { value: "absatz", label: "Absatz" },
              ] as const).map((option) => (
                <label
                  key={option.label}
                  className="inline-flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-300 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="chunk_typ"
                    checked={local.chunk_typ === option.value}
                    onChange={() =>
                      setLocal((prev) => ({ ...prev, chunk_typ: option.value }))
                    }
                    className="accent-primary-500"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Absatz-Range */}
          <div>
            <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Absatz-Bereich
            </span>
            <div className="flex items-center gap-2">
              <label htmlFor="filter-absatz-von" className="sr-only">
                Von
              </label>
              <Input
                id="filter-absatz-von"
                type="number"
                min={1}
                placeholder="Von"
                value={local.absatz_von ?? ""}
                onChange={(e) =>
                  setLocal((prev) => ({
                    ...prev,
                    absatz_von: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className="h-8 w-24"
              />
              <span className="text-sm text-neutral-500" aria-hidden="true">
                &ndash;
              </span>
              <label htmlFor="filter-absatz-bis" className="sr-only">
                Bis
              </label>
              <Input
                id="filter-absatz-bis"
                type="number"
                min={1}
                placeholder="Bis"
                value={local.absatz_bis ?? ""}
                onChange={(e) =>
                  setLocal((prev) => ({
                    ...prev,
                    absatz_bis: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className="h-8 w-24"
              />
            </div>
          </div>

          {/* Apply */}
          <Button variant="primary" size="sm" onClick={handleApply}>
            Filter anwenden
          </Button>
        </div>
      </div>
    </div>
  );
}
