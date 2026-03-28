/** Export-Datentypen -- Unified ExportData interface fuer PDF- und Markdown-Export. */

import type { SearchResultItem, CompareItem, LookupResponse } from "./api";

// ── Core Types ──────────────────────────────────────────────────────────────

export interface ExportItem {
  heading: string;
  subheading?: string;
  text: string;
  metadata?: Record<string, string>;
}

export interface ExportData {
  title: string;
  subtitle?: string;
  date: string;
  items: ExportItem[];
  disclaimer: string;
}

// Default RDG disclaimer used in all exports
export const DEFAULT_DISCLAIMER =
  "Generiert mit Paragraf -- keine individuelle Rechtsberatung (RDG).";

// ── Converter Functions ─────────────────────────────────────────────────────

export function searchToExportData(
  results: SearchResultItem[],
  query: string
): ExportData {
  return {
    title: "Suchergebnisse",
    subtitle: `Anfrage: "${query}"`,
    date: new Date().toLocaleDateString("de-DE"),
    items: results.map((r) => ({
      heading: `${r.gesetz} ${r.paragraph}`,
      subheading: r.titel || undefined,
      text: r.text,
      metadata: { Score: String(Math.round(r.score * 100) / 100) },
    })),
    disclaimer: DEFAULT_DISCLAIMER,
  };
}

export function compareToExportData(items: CompareItem[]): ExportData {
  return {
    title: "Vergleich",
    date: new Date().toLocaleDateString("de-DE"),
    items: items
      .filter((c) => c.found)
      .map((c) => ({
        heading: `${c.gesetz} ${c.paragraph}`,
        subheading: c.titel || undefined,
        text: c.text,
      })),
    disclaimer: DEFAULT_DISCLAIMER,
  };
}

export function lookupToExportData(lookup: LookupResponse): ExportData {
  return {
    title: "Nachschlagen",
    subtitle: `${lookup.gesetz} ${lookup.paragraph}`,
    date: new Date().toLocaleDateString("de-DE"),
    items: [
      {
        heading: `${lookup.gesetz} ${lookup.paragraph}`,
        subheading: lookup.titel || undefined,
        text: lookup.text,
      },
    ],
    disclaimer: DEFAULT_DISCLAIMER,
  };
}

export function singleResultToExportData(item: SearchResultItem): ExportData {
  return {
    title: "Paragraf-Export",
    subtitle: `${item.gesetz} ${item.paragraph}`,
    date: new Date().toLocaleDateString("de-DE"),
    items: [
      {
        heading: `${item.gesetz} ${item.paragraph}`,
        subheading: item.titel || undefined,
        text: item.text,
      },
    ],
    disclaimer: DEFAULT_DISCLAIMER,
  };
}
