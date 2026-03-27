import React, { useState, useEffect, useCallback } from "react";
import { ExternalLink } from "lucide-react";
import type { ReferenceItem } from "../lib/api";
import { Badge } from "@/components/ui/Badge";

interface CitationLinkProps {
  reference: ReferenceItem;
  onNavigate: (gesetz: string, paragraph: string) => void;
  depth?: number;
}

export function CitationLink({ reference, onNavigate, depth = 0 }: CitationLinkProps) {
  const [showWarning, setShowWarning] = useState(false);

  // Auto-dismiss warning after 3 seconds
  useEffect(() => {
    if (!showWarning) return;
    const timer = setTimeout(() => setShowWarning(false), 3000);
    return () => clearTimeout(timer);
  }, [showWarning]);

  const handleClick = useCallback(() => {
    if (reference.verified) {
      onNavigate(reference.gesetz, reference.paragraph);
    } else {
      setShowWarning(true);
    }
  }, [reference, onNavigate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  return (
    <span className="inline">
      <span
        role="link"
        tabIndex={0}
        aria-label={`Verweis auf ${reference.paragraph} ${reference.gesetz}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="inline-flex items-center gap-0.5 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-800/40 cursor-pointer rounded px-0.5 transition-colors"
      >
        <span>{reference.raw}</span>
        <ExternalLink
          size={14}
          className="text-primary-400 dark:text-primary-300 opacity-70 hover:opacity-100"
          aria-hidden="true"
        />
        {reference.kontext && (
          <Badge variant="default" className="text-xs ml-0.5">
            {reference.kontext}
          </Badge>
        )}
      </span>
      {showWarning && (
        <span className="block text-xs text-warning-500 mt-0.5" role="alert">
          Dieses Gesetz ist nicht indexiert.
        </span>
      )}
    </span>
  );
}
