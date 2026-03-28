/** ExportButton -- Per-Item Inline-Export-Button mit PDF/Markdown-Auswahl. */

import { useState, useEffect, useRef, useCallback } from "react";
import { Download, FileText, FileDown, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/Tooltip";
import type { ExportData } from "@/lib/export-types";
import { exportToPdf } from "@/lib/export-pdf";
import { exportToMarkdown, downloadMarkdown } from "@/lib/export-markdown";

// ── Types ───────────────────────────────────────────────────────────────────

interface ExportButtonProps {
  getData: () => ExportData;
  filename?: string;
}

type ExportStatus = "idle" | "success" | "error";

// ── Component ───────────────────────────────────────────────────────────────

export function ExportButton({ getData, filename }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ExportStatus>("idle");
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const showStatus = useCallback((s: ExportStatus) => {
    setStatus(s);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setStatus("idle"), 2000);
  }, []);

  const handlePdf = useCallback(() => {
    try {
      const data = getData();
      exportToPdf(data, filename);
      showStatus("success");
    } catch (err) {
      console.error("PDF-Export fehlgeschlagen:", err);
      showStatus("error");
    }
    setOpen(false);
  }, [getData, filename, showStatus]);

  const handleMarkdown = useCallback(() => {
    try {
      const data = getData();
      const md = exportToMarkdown(data);
      downloadMarkdown(md, filename || "paragraf-export.md");
      showStatus("success");
    } catch (err) {
      console.error("Markdown-Export fehlgeschlagen:", err);
      showStatus("error");
    }
    setOpen(false);
  }, [getData, filename, showStatus]);

  const icon =
    status === "success" ? (
      <Check className="h-4 w-4" aria-hidden="true" />
    ) : status === "error" ? (
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
    ) : (
      <Download className="h-4 w-4" aria-hidden="true" />
    );

  const tooltipLabel =
    status === "success"
      ? "Export wurde heruntergeladen"
      : status === "error"
        ? "Export fehlgeschlagen"
        : "Dieses Ergebnis exportieren";

  return (
    <div ref={containerRef} className="relative inline-block">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-[44px] min-w-[44px] p-0"
            onClick={() => setOpen((prev) => !prev)}
            aria-label="Dieses Ergebnis exportieren"
            aria-haspopup="true"
            aria-expanded={open}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltipLabel}</TooltipContent>
      </Tooltip>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-neutral-800 shadow-lg rounded-lg border border-neutral-200 dark:border-neutral-700 z-20 overflow-hidden"
        >
          <button
            role="menuitem"
            className="flex items-center gap-3 w-full px-4 min-h-[44px] text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            onClick={handlePdf}
          >
            <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
            Als PDF exportieren
          </button>
          <button
            role="menuitem"
            className="flex items-center gap-3 w-full px-4 min-h-[44px] text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            onClick={handleMarkdown}
          >
            <FileDown className="h-4 w-4 shrink-0" aria-hidden="true" />
            Als Markdown exportieren
          </button>
        </div>
      )}
    </div>
  );
}
