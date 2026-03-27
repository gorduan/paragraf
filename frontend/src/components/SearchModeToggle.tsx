import { cn } from "@/lib/utils";

type SearchMode = "semantic" | "fulltext" | "hybrid_fulltext";

interface SearchModeToggleProps {
  value: SearchMode;
  onChange: (mode: SearchMode) => void;
}

const MODES: { value: SearchMode; label: string }[] = [
  { value: "semantic", label: "Semantisch" },
  { value: "fulltext", label: "Volltext" },
  { value: "hybrid_fulltext", label: "Hybrid" },
];

export function SearchModeToggle({ value, onChange }: SearchModeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Suchmodus"
      className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-600 overflow-hidden"
    >
      {MODES.map((mode) => (
        <button
          key={mode.value}
          role="radio"
          aria-checked={value === mode.value}
          onClick={() => onChange(mode.value)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium transition-colors",
            value === mode.value
              ? "bg-primary-500 text-white"
              : "bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600"
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
