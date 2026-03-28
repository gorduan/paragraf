/** PDF-Export -- jsPDF-basierte PDF-Generierung aus ExportData. */

import { jsPDF } from "jspdf";
import type { ExportData } from "./export-types";

export function exportToPdf(data: ExportData, filename?: string): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // Helper: check page break and add disclaimer footer before new page
  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 20) {
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(data.disclaimer, margin, pageHeight - 10);
      doc.setTextColor(0);
      doc.addPage();
      y = 20;
    }
  };

  // ── Header ──────────────────────────────────────────────────────────────

  doc.setFontSize(16);
  doc.text(`Paragraf -- ${data.title}`, margin, y);
  y += 8;

  if (data.subtitle) {
    doc.setFontSize(10);
    doc.text(data.subtitle, margin, y);
    y += 6;
  }

  doc.setFontSize(10);
  doc.text(
    `Datum: ${data.date} | Eintraege: ${data.items.length}`,
    margin,
    y
  );
  y += 10;

  // Separator line
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Items ───────────────────────────────────────────────────────────────

  for (const item of data.items) {
    checkPageBreak(30);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(item.heading, margin, y);
    y += 6;

    if (item.subheading) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text(item.subheading, margin, y);
      y += 5;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const lines: string[] = doc.splitTextToSize(item.text, contentWidth);
    for (const line of lines) {
      checkPageBreak(6);
      doc.text(line, margin, y);
      y += 5;
    }

    if (item.metadata) {
      y += 2;
      doc.setFontSize(8);
      doc.setTextColor(128);
      const metaStr = Object.entries(item.metadata)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" | ");
      doc.text(metaStr, margin, y);
      doc.setTextColor(0);
      y += 5;
    }

    y += 6;
  }

  // ── Final page disclaimer footer ────────────────────────────────────────

  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text(data.disclaimer, margin, pageHeight - 10);

  const name =
    filename ||
    `paragraf-${data.title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.pdf`;
  doc.save(name);
}
