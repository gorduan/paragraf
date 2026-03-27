import { List, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "liste" | "gruppiert";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const MODES: { value: ViewMode; label: string; Icon: typeof List }[] = [
  { value: "liste", label: "Liste", Icon: List },
  { value: "gruppiert", label: "Gruppiert", Icon: LayoutGrid },
];

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Ansichtsmodus"
      className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-600 overflow-hidden"
    >
      {MODES.map((mode) => (
        <button
          key={mode.value}
          role="radio"
          aria-checked={value === mode.value}
          onClick={() => onChange(mode.value)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5",
            value === mode.value
              ? "bg-primary-500 text-white"
              : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          )}
        >
          <mode.Icon size={14} aria-hidden="true" />
          {mode.label}
        </button>
      ))}
    </div>
  );
}
