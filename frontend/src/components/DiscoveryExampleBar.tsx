import { X, Loader } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface DiscoveryExample {
  paragraph: string;
  gesetz: string;
  titel: string;
  polarity: "positive" | "negative";
}

interface DiscoveryExampleBarProps {
  examples: DiscoveryExample[];
  onRemove: (example: DiscoveryExample) => void;
  onExecute: () => void;
  onReset: () => void;
  loading: boolean;
}

export function DiscoveryExampleBar({
  examples,
  onRemove,
  onExecute,
  onReset,
  loading,
}: DiscoveryExampleBarProps) {
  const hasPositive = examples.some((e) => e.polarity === "positive");

  return (
    <div
      role="region"
      aria-label="Ausgewaehlte Beispiele fuer Entdeckungssuche"
      aria-live="polite"
      className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4"
    >
      <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
        Beispiele fuer Entdeckungssuche
      </h3>

      {examples.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {examples.map((example) => {
            const isPositive = example.polarity === "positive";
            return (
              <button
                key={`${example.gesetz}-${example.paragraph}-${example.polarity}`}
                onClick={() => onRemove(example)}
                aria-label={`Beispiel entfernen: ${example.paragraph} ${example.gesetz}`}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm border transition-colors",
                  isPositive
                    ? "bg-success-50 dark:bg-success-900 text-success-700 dark:text-success-200 border-success-200 dark:border-success-700 hover:bg-success-100 dark:hover:bg-success-800"
                    : "bg-error-50 dark:bg-error-900 text-error-700 dark:text-error-200 border-error-200 dark:border-error-700 hover:bg-error-100 dark:hover:bg-error-800"
                )}
              >
                <span>
                  {isPositive ? "+" : "-"} {example.paragraph} {example.gesetz}
                </span>
                <X size={14} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={onExecute}
          disabled={!hasPositive || loading}
          title={
            !hasPositive
              ? "Waehlen Sie mindestens ein positives Beispiel (+)."
              : undefined
          }
          className="gap-1.5"
        >
          {loading && <Loader size={14} className="animate-spin" aria-hidden="true" />}
          Entdecken
        </Button>

        {examples.length > 0 && (
          <button
            onClick={onReset}
            className="text-sm text-error-500 hover:text-error-600 dark:text-error-400 dark:hover:text-error-300 font-medium"
          >
            Zuruecksetzen
          </button>
        )}
      </div>
    </div>
  );
}
