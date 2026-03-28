/** Markdown-Export -- String-basierte Markdown-Generierung und Browser-Download. */

import type { ExportData } from "./export-types";

export function exportToMarkdown(data: ExportData): string {
  const lines: string[] = [`# Paragraf -- ${data.title}`, ``];

  if (data.subtitle) {
    lines.push(`**${data.subtitle}**`);
  }
  lines.push(`**Datum:** ${data.date}`);
  lines.push(`**Eintraege:** ${data.items.length}`);
  lines.push(``, `---`, ``);

  for (const item of data.items) {
    lines.push(`## ${item.heading}`);
    if (item.subheading) lines.push(`*${item.subheading}*`);
    lines.push(``);
    lines.push(item.text);
    if (item.metadata) {
      lines.push(``);
      const metaStr = Object.entries(item.metadata)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" | ");
      lines.push(`> ${metaStr}`);
    }
    lines.push(``, `---`, ``);
  }

  lines.push(`> ${data.disclaimer}`);
  return lines.join("\n");
}

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
