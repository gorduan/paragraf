import { useState, useEffect, useCallback } from "react";
import { Cpu, Loader, Check, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface GpuDetectionStepProps {
  onNext: () => void;
  onBack: () => void;
}

type DetectionStatus = "detecting" | "found" | "not-found" | "activating" | "failed";

// ── Component ───────────────────────────────────────────────────────────────

export function GpuDetectionStep({ onNext, onBack }: GpuDetectionStepProps) {
  const [status, setStatus] = useState<DetectionStatus>("detecting");
  const [gpuName, setGpuName] = useState("");
  const [vramMb, setVramMb] = useState(0);

  // Auto-detect GPU on mount
  useEffect(() => {
    api.gpuDetection().then((res) => {
      if (res.nvidia_smi_available || res.cuda_available) {
        setGpuName(res.gpu_name);
        setVramMb(res.vram_total_mb);
        setStatus("found");
      } else {
        setStatus("not-found");
      }
    }).catch(() => {
      setStatus("not-found");
    });
  }, []);

  const handleEnableGpu = useCallback(async () => {
    setStatus("activating");
    try {
      const result = await window.paragrafSetup?.switchGpu(true);
      if (result?.success) {
        onNext();
      } else {
        setStatus("failed");
      }
    } catch {
      setStatus("failed");
    }
  }, [onNext]);

  const handleSkipGpu = useCallback(() => {
    onNext();
  }, [onNext]);

  const vramGb = vramMb > 0 ? (vramMb / 1024).toFixed(0) : "0";

  return (
    <div className="px-8 py-10">
      <h2 className="text-xl font-bold mb-2">GPU-Erkennung</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
        GPU-Beschleunigung macht die Rechtsrecherche deutlich schneller.
      </p>

      {/* Detecting */}
      {status === "detecting" && (
        <div className="flex items-center gap-3 py-8 justify-center" role="status">
          <Loader size={20} className="animate-spin text-primary-500" aria-hidden="true" />
          <span className="text-sm text-neutral-500">GPU wird erkannt...</span>
        </div>
      )}

      {/* Found */}
      {status === "found" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Cpu size={20} className="text-primary-500" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                    {gpuName}
                  </p>
                  <p className="text-xs text-neutral-500">{vramGb} GB VRAM</p>
                </div>
              </div>
              <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium px-2 py-0.5 rounded-full">
                Empfohlen
              </span>
            </div>
          </div>

          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            NVIDIA {gpuName} erkannt ({vramGb} GB VRAM).
            GPU-Modus beschleunigt die Suche deutlich.
          </p>
        </div>
      )}

      {/* Not found */}
      {status === "not-found" && (
        <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 mb-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Keine NVIDIA-GPU erkannt. Paragraf laeuft im CPU-Modus.
            Dies funktioniert problemlos, die Suche dauert nur etwas laenger.
          </p>
        </div>
      )}

      {/* Activating */}
      {status === "activating" && (
        <div className="flex items-center gap-3 py-8 justify-center" role="status">
          <Loader size={20} className="animate-spin text-primary-500" aria-hidden="true" />
          <span className="text-sm text-neutral-500">GPU wird aktiviert...</span>
        </div>
      )}

      {/* Failed */}
      {status === "failed" && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-4 mb-4" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              GPU-Modus konnte nicht aktiviert werden. CPU-Modus wird verwendet.
            </p>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex justify-between pt-6">
        <button
          onClick={onBack}
          disabled={status === "activating"}
          className="px-6 py-2.5 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
        >
          Zurueck
        </button>

        {status === "found" ? (
          <div className="flex gap-3">
            <button
              onClick={handleSkipGpu}
              className="px-6 py-2.5 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              CPU beibehalten
            </button>
            <button
              onClick={handleEnableGpu}
              className="px-6 py-2.5 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 font-medium"
            >
              GPU aktivieren (Empfohlen)
            </button>
          </div>
        ) : (status === "not-found" || status === "failed") ? (
          <button
            onClick={onNext}
            className="px-6 py-2.5 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 font-medium"
          >
            Weiter
          </button>
        ) : null}
      </div>
    </div>
  );
}
