/**
 * GraphLegend — Farblegende fuer Kanten-Kontexttypen im Zitationsgraph.
 * Zusammenklappbar mit localStorage-Persistenz.
 */

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { EDGE_COLORS } from "@/lib/graph-utils";

// ── Legend entries ───────────────────────────────────────────────────────────

const LEGEND_ENTRIES = [
  { key: "i.V.m." as const, label: "i.V.m." },
  { key: "gemaess" as const, label: "gemaess" },
  { key: "nach" as const, label: "nach" },
  { key: "siehe" as const, label: "siehe" },
  { key: "null" as const, label: "ohne Kontext" },
] as const;

const STORAGE_KEY = "paragraf_graph_legend";

// ── Component ───────────────────────────────────────────────────────────────

interface GraphLegendProps {
  isDark: boolean;
}

export function GraphLegend({ isDark }: GraphLegendProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "collapsed";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "collapsed" : "expanded");
    } catch {
      // Ignore storage errors
    }
  }, [collapsed]);

  const colors = isDark ? EDGE_COLORS.dark : EDGE_COLORS.light;

  return (
    <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-md border border-neutral-200 dark:border-neutral-700 p-2 z-10">
      {/* Title with toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-1 w-full text-caption font-semibold text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
        aria-expanded={!collapsed}
        aria-controls="graph-legend-entries"
      >
        <span>Verweistypen</span>
        {collapsed ? (
          <ChevronDown size={14} aria-hidden="true" />
        ) : (
          <ChevronUp size={14} aria-hidden="true" />
        )}
      </button>

      {/* Legend entries */}
      {!collapsed && (
        <div id="graph-legend-entries" className="mt-2 space-y-1">
          {LEGEND_ENTRIES.map((entry) => (
            <div key={entry.key} className="flex items-center gap-2">
              <div
                className="w-6 h-0.5 shrink-0 rounded-full"
                style={{ backgroundColor: colors[entry.key] }}
                aria-hidden="true"
              />
              <span className="text-caption text-neutral-600 dark:text-neutral-400">
                {entry.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
