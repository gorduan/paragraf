import type { ReferenceItem } from "./api";

export interface ParsedSegment {
  type: "text" | "citation";
  content: string;
  reference?: ReferenceItem;
}

/**
 * Zerlegt Paragraphentext in Text- und Zitations-Segmente.
 *
 * Sortiert Referenzen nach Laenge des raw-Strings absteigend (longest match first),
 * findet Positionen im Text, entfernt Ueberlappungen und gibt geordnete Segmente zurueck.
 */
export function parseCitations(text: string, references: ReferenceItem[]): ParsedSegment[] {
  if (!text || references.length === 0) {
    return [{ type: "text", content: text }];
  }

  // 1. Sort references by raw string length descending (longest match first)
  const sorted = [...references].sort((a, b) => b.raw.length - a.raw.length);

  // 2. Find match positions for each reference
  const matches: { start: number; end: number; reference: ReferenceItem }[] = [];

  for (const ref of sorted) {
    const idx = text.indexOf(ref.raw);
    if (idx === -1) continue;

    const start = idx;
    const end = idx + ref.raw.length;

    // Skip if overlaps with an existing match
    const overlaps = matches.some(
      (m) => start < m.end && end > m.start
    );
    if (overlaps) continue;

    matches.push({ start, end, reference: ref });
  }

  if (matches.length === 0) {
    return [{ type: "text", content: text }];
  }

  // 3. Sort matches by start position
  matches.sort((a, b) => a.start - b.start);

  // 4. Build segments
  const segments: ParsedSegment[] = [];
  let cursor = 0;

  for (const match of matches) {
    // Text before this match
    if (cursor < match.start) {
      segments.push({ type: "text", content: text.slice(cursor, match.start) });
    }
    // Citation segment
    segments.push({
      type: "citation",
      content: text.slice(match.start, match.end),
      reference: match.reference,
    });
    cursor = match.end;
  }

  // Remaining text after last match
  if (cursor < text.length) {
    segments.push({ type: "text", content: text.slice(cursor) });
  }

  return segments;
}
