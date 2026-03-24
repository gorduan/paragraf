import React from "react";
import { Loader, WifiOff, RefreshCw, CheckCircle } from "lucide-react";
import type { HealthState } from "../hooks/useHealthCheck";
import type { HealthResponse } from "../lib/api";

interface HealthOverlayProps {
  state: HealthState;
  health: HealthResponse | null;
  error: string | null;
  onRetry: () => void;
}

export function HealthOverlay({ state, health, error, onRetry }: HealthOverlayProps) {
  // Don't show overlay when ready
  if (state === "ready") return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Verbindungsstatus"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-8 text-center" aria-live="polite">
        <h1 className="text-2xl font-bold mb-2 text-primary-600 dark:text-primary-400">
          Paragraf
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Deutsches Recht – Semantische Suche
        </p>

        {state === "connecting" && (
          <div className="space-y-4">
            <Loader size={40} className="animate-spin text-primary-500 mx-auto" aria-hidden="true" />
            <p className="text-slate-600 dark:text-slate-300" role="status">
              Verbindung zum Backend wird hergestellt...
            </p>
            <p className="text-xs text-slate-400">
              Das Backend laedt beim ersten Start die ML-Modelle (~2 GB).
              Dies kann einige Minuten dauern.
            </p>
          </div>
        )}

        {state === "loading" && (
          <div className="space-y-4">
            <Loader size={40} className="animate-spin text-yellow-500 mx-auto" aria-hidden="true" />
            <p className="text-slate-600 dark:text-slate-300" role="status">
              Modelle werden geladen...
            </p>
            {health && (
              <div className="text-xs text-slate-400 space-y-1">
                <p>Embedding: {health.embedding_model}</p>
                <p>Qdrant: {health.qdrant_status}</p>
              </div>
            )}
          </div>
        )}

        {state === "error" && (
          <div className="space-y-4">
            <WifiOff size={40} className="text-red-500 mx-auto" aria-hidden="true" />
            <p className="text-red-600 dark:text-red-400" role="alert">
              Backend nicht erreichbar
            </p>
            {error && (
              <p className="text-xs text-slate-400">{error}</p>
            )}
            <div className="text-xs text-slate-400 space-y-1">
              <p>Stellen Sie sicher, dass alle Container laufen:</p>
              <code className="block bg-slate-100 dark:bg-slate-700 px-3 py-2 rounded text-left">
                docker compose up
              </code>
            </div>
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 mx-auto"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Erneut versuchen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
