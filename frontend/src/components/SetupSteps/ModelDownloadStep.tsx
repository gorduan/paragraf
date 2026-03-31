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
  downloadedBytes: number;
  totalBytes: number;
  speedMbps: number;
  etaSeconds: number;
  status: "waiting" | "downloading" | "complete" | "error";
  errorMessage?: string;
}

type StepStatus = "idle" | "checking" | "waiting-backend" | "warning" | "downloading" | "complete" | "error";

// ── Constants ───────────────────────────────────────────────────────────────

const INITIAL_MODELS: ModelState[] = [
  { name: "BAAI/bge-m3", label: "Embedding-Modell (BAAI/bge-m3)", downloadedBytes: 0, totalBytes: 2_300_000_000, speedMbps: 0, etaSeconds: 0, status: "waiting" },
  { name: "BAAI/bge-reranker-v2-m3", label: "Reranker-Modell (BAAI/bge-reranker-v2-m3)", downloadedBytes: 0, totalBytes: 1_100_000_000, speedMbps: 0, etaSeconds: 0, status: "waiting" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  return (bytes / (1024 ** 3)).toFixed(1);
}

function formatEta(seconds: number): string {
  if (seconds <= 0) return "--";
  if (seconds < 60) return `${Math.round(seconds)} Sek.`;
  return `${Math.round(seconds / 60)} Min.`;
}

// ── Component ───────────────────────────────────────────────────────────────

export function ModelDownloadStep({ onNext, onBack }: ModelDownloadStepProps) {
  const [status, setStatus] = useState<StepStatus>("idle");
  const [models, setModels] = useState<ModelState[]>(INITIAL_MODELS);
  const [freeGb, setFreeGb] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const downloadRef = useRef<{ cancel: () => void } | null>(null);
  const throttleRef = useRef<number>(0);

  // Wait for backend to be ready, then check model status
  useEffect(() => {
    let cancelled = false;
    setStatus("waiting-backend");

    const pollBackend = async () => {
      while (!cancelled) {
        try {
          const res = await api.modelStatus();
          if (cancelled) return;
          if (res.models_ready) {
            setStatus("complete");
            setModels((prev) =>
              prev.map((m) => {
                const serverModel = res.models.find((sm) => sm.name === m.name);
                return serverModel?.downloaded
                  ? { ...m, status: "complete" as const, downloadedBytes: m.totalBytes }
                  : m;
              }),
            );
          } else {
            setStatus("idle");
          }
          return;
        } catch {
          // Backend not ready yet, retry in 3s
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
            m.name === event.model ? { ...m, status: "downloading" } : m,
          ),
        );
        break;
      case "progress": {
        // Throttle UI updates to ~500ms
        const now = Date.now();
        if (now - throttleRef.current < 500) return;
        throttleRef.current = now;
        setModels((prev) =>
          prev.map((m) =>
            m.name === event.model
              ? {
                  ...m,
                  downloadedBytes: event.downloaded_bytes ?? m.downloadedBytes,
                  totalBytes: event.total_bytes ?? m.totalBytes,
                  speedMbps: event.speed_mbps ?? m.speedMbps,
                  etaSeconds: event.eta_seconds ?? m.etaSeconds,
                }
              : m,
          ),
        );
        break;
      }
      case "complete":
        setModels((prev) =>
          prev.map((m) =>
            m.name === event.model
              ? { ...m, status: "complete", downloadedBytes: m.totalBytes }
              : m,
          ),
        );
        break;
      case "retry":
        // Show retry status on the model
        setModels((prev) =>
          prev.map((m) =>
            m.name === event.model
              ? { ...m, errorMessage: `Versuch ${event.attempt} von ${event.max_attempts}` }
              : m,
          ),
        );
        break;
      case "error":
        setModels((prev) =>
          prev.map((m) =>
            m.name === event.model
              ? { ...m, status: "error", errorMessage: event.message ?? "Unbekannter Fehler" }
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
    setModels(INITIAL_MODELS);
    const handle = api.downloadModels(handleProgress);
    downloadRef.current = handle;
  }, [handleProgress]);

  const percent = (m: ModelState) =>
    m.totalBytes > 0 ? Math.round((m.downloadedBytes / m.totalBytes) * 100) : 0;

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
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                {m.label}
              </span>
              <span className="text-xs text-neutral-500">
                {formatBytes(m.totalBytes)} GB
              </span>
            </div>

            {/* Progress bar */}
            {m.status === "downloading" && (
              <>
                <div
                  className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={percent(m)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${m.label}: ${percent(m)}%`}
                >
                  <div
                    className="h-full rounded-full bg-primary-500 transition-all duration-300"
                    style={{ width: `${percent(m)}%` }}
                  />
                </div>
                <p className="text-xs text-neutral-500 mt-1.5" aria-live="polite">
                  {formatBytes(m.downloadedBytes)} / {formatBytes(m.totalBytes)} GB
                  {" \u2014 "}
                  {m.speedMbps > 0 ? `${m.speedMbps.toFixed(1)} MB/s` : "..."}
                  {" \u2014 "}
                  ca. {formatEta(m.etaSeconds)}
                  {m.errorMessage && ` (${m.errorMessage})`}
                </p>
              </>
            )}

            {/* Waiting */}
            {m.status === "waiting" && status === "downloading" && (
              <p className="text-xs text-neutral-400">Wartet...</p>
            )}

            {/* Complete */}
            {m.status === "complete" && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Check size={16} aria-hidden="true" />
                <span className="text-sm">Heruntergeladen</span>
              </div>
            )}

            {/* Error */}
            {m.status === "error" && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle size={16} aria-hidden="true" />
                  <span className="text-sm">{m.errorMessage}</span>
                </div>
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

      {/* Checking spinner */}
      {status === "checking" && (
        <div className="flex items-center gap-2 text-neutral-500 mb-4" role="status">
          <Loader size={16} className="animate-spin" aria-hidden="true" />
          <span className="text-sm">Modell-Status wird geprueft...</span>
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
            disabled={status === "downloading" || status === "checking" || status === "waiting-backend"}
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
