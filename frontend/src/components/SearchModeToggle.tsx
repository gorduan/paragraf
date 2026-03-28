import { cn } from "@/lib/utils";

type SearchMode = "semantic" | "fulltext" | "hybrid_fulltext" | "multi_hop";

interface SearchModeToggleProps {
  value: SearchMode;
  onChange: (mode: SearchMode) => void;
  isDiscoveryMode?: boolean;
  onDiscoveryToggle?: (active: boolean) => void;
}

const MODES: { value: SearchMode; label: string }[] = [
  { value: "semantic", label: "Semantisch" },
  { value: "fulltext", label: "Volltext" },
  { value: "hybrid_fulltext", label: "Hybrid" },
  { value: "multi_hop", label: "Verweissuche" },
];

export function SearchModeToggle({
  value,
  onChange,
  isDiscoveryMode = false,
  onDiscoveryToggle,
}: SearchModeToggleProps) {
  const baseStyle = "px-3 py-1.5 text-sm font-medium transition-colors";
  const activeStyle = "bg-primary-500 text-white";
  const inactiveStyle =
    "bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600";

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
          aria-checked={!isDiscoveryMode && value === mode.value}
          onClick={() => {
            if (isDiscoveryMode) {
              onDiscoveryToggle?.(false);
            }
            onChange(mode.value);
          }}
          className={cn(
            baseStyle,
            !isDiscoveryMode && value === mode.value
              ? activeStyle
              : inactiveStyle
          )}
        >
          {mode.label}
        </button>
      ))}
      <button
        role="radio"
        aria-checked={isDiscoveryMode}
        onClick={() => onDiscoveryToggle?.(!isDiscoveryMode)}
        className={cn(
          baseStyle,
          isDiscoveryMode ? activeStyle : inactiveStyle
        )}
      >
        Entdecken
      </button>
    </div>
  );
}
