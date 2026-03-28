/**
 * GraphSidePanel — Detail-Panel fuer einen ausgewaehlten Graph-Knoten.
 * Zeigt Paragraph-Info, Verweis-Zaehler und Navigation zum Detail.
 */

import { X, Loader, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { GraphNode } from "@/lib/graph-utils";
import type { ReferenceNetworkResponse } from "@/lib/api";

// ── Props ───────────────────────────────────────────────────────────────────

interface GraphSidePanelProps {
  node: GraphNode | null;
  referenceData: ReferenceNetworkResponse | null;
  loading: boolean;
  onClose: () => void;
  onNavigate: (gesetz: string, paragraph: string) => void;
  onDrillDown?: (gesetz: string) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export function GraphSidePanel({
  node,
  referenceData,
  loading,
  onClose,
  onNavigate,
  onDrillDown,
}: GraphSidePanelProps) {
  if (!node) return null;

  return (
    <aside
      role="complementary"
      aria-label={`Details zu ${node.label}`}
      className="w-80 shrink-0 bg-neutral-50 dark:bg-neutral-800 border-l border-neutral-200 dark:border-neutral-700 p-6 overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-subheading font-semibold text-neutral-900 dark:text-neutral-100 truncate">
          {node.label}
        </h2>
        <button
          onClick={onClose}
          aria-label="Seitenpanel schliessen"
          className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 transition-colors"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {/* Type info */}
      <div className="mb-4">
        <Badge variant={node.type === "law" ? "primary" : "default"}>
          {node.type === "law" ? "Gesetz" : "Paragraph"}
        </Badge>
        {node.paragraph && (
          <span className="ml-2 text-caption text-neutral-500 dark:text-neutral-400">
            {node.gesetz}
          </span>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader size={20} className="animate-spin text-primary-500" aria-hidden="true" />
          <span className="ml-2 text-body text-neutral-500">Lade Verweise...</span>
        </div>
      )}

      {/* Reference data */}
      {!loading && referenceData && (
        <div className="space-y-4">
          {/* Outgoing references */}
          <div className="flex items-center gap-2">
            <ArrowUpRight size={16} className="text-primary-500" aria-hidden="true" />
            <span className="text-body text-neutral-700 dark:text-neutral-300">
              Ausgehende Verweise:
            </span>
            <Badge variant="primary">{referenceData.outgoing.length}</Badge>
          </div>

          {/* Incoming references */}
          <div className="flex items-center gap-2">
            <ArrowDownLeft size={16} className="text-success-500" aria-hidden="true" />
            <span className="text-body text-neutral-700 dark:text-neutral-300">
              Eingehende Verweise:
            </span>
            <Badge variant="success">{referenceData.incoming_count}</Badge>
          </div>

          {/* Top outgoing references list */}
          {referenceData.outgoing.length > 0 && (
            <div className="mt-4">
              <h3 className="text-caption font-semibold text-neutral-600 dark:text-neutral-400 mb-2">
                Verweist auf
              </h3>
              <ul className="space-y-1">
                {referenceData.outgoing.slice(0, 8).map((ref, i) => (
                  <li
                    key={`${ref.gesetz}-${ref.paragraph}-${i}`}
                    className="text-caption text-neutral-600 dark:text-neutral-400 flex items-center gap-1"
                  >
                    <span className="truncate">
                      {ref.paragraph} {ref.gesetz}
                    </span>
                    {ref.kontext && (
                      <span className="text-neutral-400 dark:text-neutral-500 shrink-0">
                        ({ref.kontext})
                      </span>
                    )}
                  </li>
                ))}
                {referenceData.outgoing.length > 8 && (
                  <li className="text-caption text-neutral-400">
                    ... und {referenceData.outgoing.length - 8} weitere
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* No reference data and not loading */}
      {!loading && !referenceData && node.type === "paragraph" && (
        <p className="text-body text-neutral-500 dark:text-neutral-400">
          Keine Verweisdaten verfuegbar.
        </p>
      )}

      {/* Law-level info when no reference data */}
      {!loading && !referenceData && node.type === "law" && (
        <div className="space-y-2">
          <p className="text-body text-neutral-600 dark:text-neutral-400">
            Verweise: <span className="font-semibold">{node.refCount}</span>
          </p>
        </div>
      )}

      {/* Drill-down button for law nodes */}
      {node.type === "law" && onDrillDown && (
        <div className="mt-6">
          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={() => onDrillDown(node.gesetz)}
          >
            Paragraphen anzeigen
          </Button>
        </div>
      )}

      {/* Navigation button for paragraph nodes */}
      {node.paragraph && (
        <div className="mt-6">
          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={() => onNavigate(node.gesetz, node.paragraph!)}
          >
            Im Detail anzeigen
          </Button>
        </div>
      )}
    </aside>
  );
}
