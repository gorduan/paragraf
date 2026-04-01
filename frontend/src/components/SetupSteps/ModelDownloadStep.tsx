import { useState, useEffect, useRef, useCallback } from "react";
import { Check, AlertTriangle, Loader, RefreshCw } from "lucide-react";
import { api, type ModelDownloadEvent } from "../../lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface ModelDownloadStepProps {
  onNext: () => void;
  onBack: () => void;
}

interface ModelState {
  name: string;
  label: string;
  status: "waiting" | "downloading" | "complete" | "error";
  message?: string;
  downloadedBytes: number;
  totalBytes: number;
  speedMbps: number;
  etaSeconds: number;
}

type StepStatus = "waiting-backend" | "idle" | "warning" | "downloading" | "complete" | "error";

// ── Component ───────────────────────────────────────────────────────────────

export function ModelDownloadStep({ onNext, onBack }: ModelDownloadStepProps) {
  const [status, setStatus] = useState<StepStatus>("waiting-backend");
  const [models, setModels] = useState<ModelState[]>([
    { name: "BAAI/bge-m3", label: "Embedding-Modell (BAAI/bge-m3)", status: "waiting", downloadedBytes: 0, totalBytes: 0, speedMbps: 0, etaSeconds: 0 },
    { name: "BAAI/bge-reranker-v2-m3", label: "Reranker-Modell (BAAI/bge-reranker-v2-m3)", status: "waiting", downloadedBytes: 0, totalBytes: 0, speedMbps: 0, etaSeconds: 0 },
  ]);
  const [freeGb, setFreeGb] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const downloadRef = useRef<{ cancel: () => void } | null>(null);

  // Wait for backend, then check model status
  useEffect(() => {
    let cancelled = false;

    const pollBackend = async () => {
      while (!cancelled) {
        try {
          const res = await api.modelStatus();
          if (cancelled) return;
          if (res.models_ready) {
            setModels((prev) =>
              prev.map((m) => {
                const sm = res.models.find((s) => s.name === m.name);
                return sm?.downloaded ? { ...m, status: "complete" as const } : m;
              }),
            );
            setStatus("complete");
          } else {
            setStatus("idle");
          }
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    };

    pollBackend();
    return () => { cancelled = true; };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { downloadRef.current?.cancel(); };
  }, []);

  const handleProgress = useCallback((event: ModelDownloadEvent) => {
    switch (event.type) {
      case "disk_check":
        setFreeGb(event.free_gb ?? 0);
        break;
      case "disk_warning":
        setFreeGb(event.free_gb ?? 0);
        setStatus("warning");
        break;
      case "start":
        setModels((prev) =>
          prev.map((m) =>
            m.name === event.model ? { ...m, status: "downloading", message: undefined } : m,
          ),
        );
        break;
      case "progress":
        setModels((prev) =>
          prev.map((m) =>
            m.name === event.model ? {
              ...m,
              message: event.message,
              downloadedBytes: event.downloaded_bytes ?? m.downloadedBytes,
              totalBytes: event.total_bytes ?? m.totalBytes,
              speedMbps: event.speed_mbps ?? m.speedMbps,
              etaSeconds: event.eta_seconds ?? m.etaSeconds,
            } : m,
          ),
        );
        break;
      case "complete":
        setModels((prev) =>
          prev.map((m) =>
            m.name === event.model ? { ...m, status: "complete", message: undefined } : m,
          ),
        );
        break;
      case "retry":
        setModels((prev) =>
          prev.map((m) =>
            m.name === event.model
              ? { ...m, message: `Versuch ${event.attempt} von ${event.max_attempts}...` }
              : m,
          ),
        );
        break;
      case "error":
        setModels((prev) =>
          prev.map((m) =>
            m.name === event.model
              ? { ...m, status: "error", message: event.message ?? "Fehler" }
              : m,
          ),
        );
        setErrorMessage(event.message ?? "Download fehlgeschlagen");
        setStatus("error");
        break;
      case "all_complete":
        setStatus("complete");
        break;
    }
  }, []);

  const handleStartDownload = useCallback(() => {
    setStatus("downloading");
    setErrorMessage("");
    setModels((prev) => prev.map((m) => ({ ...m, status: "waiting" as const, message: undefined, downloadedBytes: 0, totalBytes: 0, speedMbps: 0, etaSeconds: 0 })));
    const handle = api.downloadModels(handleProgress);
    downloadRef.current = handle;
  }, [handleProgress]);

  return (
    <div className="px-8 py-10">
      <h2 className="text-xl font-bold mb-2">ML-Modelle herunterladen</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
        Paragraf benoetigt zwei KI-Modelle fuer die Rechtsrecherche.
        Der Download kann einige Minuten dauern.
      </p>

      {/* Disk space warning */}
      {status === "warning" && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-500 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Wenig Speicherplatz: {freeGb.toFixed(1)} GB frei, 5.0 GB benoetigt.
              </p>
              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => window.paragrafSetup?.selectModelCachePath()}
                  className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                >
                  Pfad aendern
                </button>
                <button
                  onClick={handleStartDownload}
                  className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
                >
                  Trotzdem versuchen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Model cards */}
      <div className="space-y-4 mb-6">
        {models.map((m) => (
          <div
            key={m.name}
            className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                {m.label}
              </span>
              {m.status === "downloading" && (
                <Loader size={16} className="animate-spin text-primary-500" aria-hidden="true" />
              )}
              {m.status === "complete" && (
                <Check size={16} className="text-green-500" aria-hidden="true" />
              )}
              {m.status === "error" && (
                <AlertTriangle size={16} className="text-red-500" aria-hidden="true" />
              )}
            </div>

            {/* Status text */}
            {m.status === "waiting" && status === "downloading" && (
              <p className="text-xs text-neutral-400 mt-2">Wartet...</p>
            )}
            {m.status === "downloading" && (
              <div className="mt-2">
                {m.totalBytes > 0 ? (
                  <div
                    className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={Math.round((m.downloadedBytes / m.totalBytes) * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${m.label}: ${Math.round((m.downloadedBytes / m.totalBytes) * 100)}%`}
                  >
                    <div
                      className="h-full rounded-full bg-primary-500 transition-all duration-500"
                      style={{ width: `${Math.round((m.downloadedBytes / m.totalBytes) * 100)}%` }}
                    />
                  </div>
                ) : (
                  <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                    <div className="h-full rounded-full bg-primary-500 animate-pulse w-full" />
                  </div>
                )}
                <p className="text-xs text-neutral-500 mt-1.5" aria-live="polite">
                  {m.totalBytes > 0
                    ? `${(m.downloadedBytes / (1024**3)).toFixed(1)} / ${(m.totalBytes / (1024**3)).toFixed(1)} GB \u2014 ${m.speedMbps.toFixed(1)} MB/s \u2014 ca. ${m.etaSeconds > 60 ? `${Math.round(m.etaSeconds / 60)} Min.` : `${m.etaSeconds} Sek.`}`
                    : (m.message || "Wird heruntergeladen...")}
                </p>
              </div>
            )}
            {m.status === "complete" && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">Heruntergeladen</p>
            )}
            {m.status === "error" && (
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-red-600 dark:text-red-400">{m.message}</p>
                <button
                  onClick={handleStartDownload}
                  className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1 hover:underline"
                >
                  <RefreshCw size={12} aria-hidden="true" />
                  Erneut versuchen
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Waiting for backend */}
      {status === "waiting-backend" && (
        <div className="flex items-center gap-2 text-neutral-500 mb-4" role="status">
          <Loader size={16} className="animate-spin" aria-hidden="true" />
          <span className="text-sm">Backend wird gestartet... Bitte warten.</span>
        </div>
      )}

      {/* Error message */}
      {status === "error" && errorMessage && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-4" role="alert">
          {errorMessage}
        </p>
      )}

      {/* Buttons */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          disabled={status === "downloading"}
          className="px-6 py-2.5 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
        >
          Zurueck
        </button>

        {status === "complete" ? (
          <button
            onClick={onNext}
            className="px-6 py-2.5 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 font-medium"
          >
            Weiter
          </button>
        ) : (
          <button
            onClick={handleStartDownload}
            disabled={status === "downloading" || status === "waiting-backend"}
            className="px-6 py-2.5 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-wait flex items-center gap-2"
          >
            {status === "downloading" && (
              <Loader size={14} className="animate-spin" aria-hidden="true" />
            )}
            {status === "downloading" ? "Download laeuft..." : "Download starten"}
          </button>
        )}
      </div>
    </div>
  );
}
