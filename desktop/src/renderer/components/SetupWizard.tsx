import React, { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Loader,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Cpu,
  Zap,
  Download,
} from "lucide-react";
import { useBackend } from "../hooks/useBackend";
import { api } from "../lib/api";
import type { IndexProgressEvent } from "../lib/api";
import { ProgressBar } from "./ProgressBar";

interface SetupWizardProps {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(0);
  const [qdrantOk, setQdrantOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState<IndexProgressEvent | null>(null);
  const [indexDone, setIndexDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backend = useBackend();

  // GPU & Torch detection
  const [gpuInfo, setGpuInfo] = useState<{ available: boolean; name: string; vramMb: number } | null>(null);
  const [torchInfo, setTorchInfo] = useState<{ installed: boolean; version: string; cuda: boolean } | null>(null);
  const [torchVariant, setTorchVariant] = useState<"cpu" | "cuda">("cpu");
  const [installing, setInstalling] = useState(false);
  const [installLog, setInstallLog] = useState("");
  const [installDone, setInstallDone] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const steps = [
    "Willkommen",
    "Pakete & GPU",
    "Qdrant prüfen",
    "Backend starten",
    "Gesetze indexieren",
    "Fertig",
  ];

  // Qdrant-Status live verfolgen
  useEffect(() => {
    if (backend.status.qdrant && !qdrantOk) {
      setQdrantOk(true);
    }
  }, [backend.status.qdrant, qdrantOk]);

  // Auto-detect GPU + Torch when entering step 1
  useEffect(() => {
    if (step === 1 && !gpuInfo && !detecting) {
      runDetection();
    }
  }, [step]);

  const runDetection = async () => {
    setDetecting(true);
    setError(null);
    try {
      const [gpu, torch] = await Promise.all([
        window.electronAPI?.setup.detectGpu(),
        window.electronAPI?.setup.detectTorch(),
      ]);
      if (gpu) {
        setGpuInfo(gpu);
        setTorchVariant(gpu.available ? "cuda" : "cpu");
      }
      if (torch) {
        setTorchInfo(torch);
        // If torch is already installed with matching variant, mark as done
        if (torch.installed) {
          if (gpu?.available && torch.cuda) {
            setInstallDone(true);
          } else if (!gpu?.available && !torch.cuda) {
            setInstallDone(true);
          }
        }
      }
    } catch {
      setError("Erkennung fehlgeschlagen.");
    } finally {
      setDetecting(false);
    }
  };

  const installTorch = async () => {
    setInstalling(true);
    setInstallLog("");
    setError(null);

    const unsub = window.electronAPI?.setup.onInstallProgress((text) => {
      setInstallLog((prev) => prev + text);
    });

    try {
      const result = await window.electronAPI?.setup.installTorch(torchVariant);
      if (result?.success) {
        setInstallDone(true);
        // Re-detect to update version info
        const torch = await window.electronAPI?.setup.detectTorch();
        if (torch) setTorchInfo(torch);
      } else {
        setError("Installation fehlgeschlagen. Details im Log.");
      }
    } catch {
      setError("Installation fehlgeschlagen.");
    } finally {
      setInstalling(false);
      unsub?.();
    }
  };

  const checkQdrant = async () => {
    setError(null);
    setChecking(true);
    try {
      const ok = await window.electronAPI?.backend.checkQdrant();
      setQdrantOk(ok ?? false);
      if (!ok) {
        setError(
          "Qdrant läuft nicht auf Port 6333.\n" +
          "Bitte Qdrant starten: E:\\qdrant\\qdrant.exe"
        );
      }
    } catch {
      setQdrantOk(false);
      setError("Qdrant-Prüfung fehlgeschlagen.");
    } finally {
      setChecking(false);
    }
  };

  const startBackend = async () => {
    setError(null);
    try {
      await backend.start();
    } catch {
      setError("Backend konnte nicht gestartet werden.");
    }
  };

  const startIndexing = () => {
    setIndexing(true);
    setError(null);
    api.indexGesetze({}, (event) => {
      setIndexProgress(event);
      if (event.schritt === "error") {
        setError(event.nachricht);
      }
      if (event.schritt === "done") {
        if (event.gesamt > 0 && event.fortschritt >= event.gesamt) {
          setIndexDone(true);
          setIndexing(false);
        }
      }
    });
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold">Willkommen bei Paragraf</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Paragraf durchsucht deutsche Gesetze mit semantischer Suche.
              Dieser Assistent hilft Ihnen bei der Ersteinrichtung.
            </p>
            <div className="text-sm text-slate-400 space-y-1">
              <p>Voraussetzungen:</p>
              <ul className="list-disc list-inside">
                <li>Qdrant (läuft auf Port 6333)</li>
                <li>Internetverbindung (Modelle + Gesetze laden)</li>
                <li>~2–4 GB Speicherplatz (Modelle)</li>
              </ul>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Pakete & GPU</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              PyTorch wird für die Embedding- und Reranking-Modelle benötigt.
              Mit einer NVIDIA-GPU ist die Suche deutlich schneller.
            </p>

            {/* GPU Detection */}
            {detecting ? (
              <div className="flex items-center gap-3 p-4 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <Loader size={20} className="animate-spin text-blue-400" />
                <span>Erkenne Hardware...</span>
              </div>
            ) : gpuInfo && (
              <div className={`flex items-center gap-3 p-4 rounded-lg ${
                gpuInfo.available
                  ? "bg-green-50 dark:bg-green-900/20"
                  : "bg-slate-100 dark:bg-slate-700"
              }`}>
                {gpuInfo.available ? (
                  <>
                    <Zap size={20} className="text-green-500" />
                    <div>
                      <span className="font-medium text-green-700 dark:text-green-300">
                        {gpuInfo.name}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">
                        {gpuInfo.vramMb} MB VRAM
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <Cpu size={20} className="text-slate-400" />
                    <span className="text-slate-500">
                      Keine NVIDIA-GPU erkannt – nur CPU verfügbar
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Current Torch info */}
            {torchInfo && torchInfo.installed && (
              <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-700/50 rounded p-3">
                Aktuell installiert: PyTorch {torchInfo.version}
                {torchInfo.cuda ? " (mit CUDA)" : " (nur CPU)"}
              </div>
            )}

            {/* Variant Selection */}
            {!installing && !installDone && gpuInfo && (
              <div className="space-y-2">
                <p className="text-sm font-medium">PyTorch-Version wählen:</p>
                <div className="grid grid-cols-1 gap-2">
                  {gpuInfo.available && (
                    <label
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        torchVariant === "cuda"
                          ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                          : "border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="torch"
                        value="cuda"
                        checked={torchVariant === "cuda"}
                        onChange={() => setTorchVariant("cuda")}
                        className="accent-primary-600"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <Zap size={16} className="text-amber-500" />
                          <span className="font-medium">GPU (CUDA)</span>
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">Empfohlen</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          ~2.5 GB Download – nutzt {gpuInfo.name} für schnellere Suche
                        </p>
                      </div>
                    </label>
                  )}
                  <label
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      torchVariant === "cpu"
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                        : "border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="torch"
                      value="cpu"
                      checked={torchVariant === "cpu"}
                      onChange={() => setTorchVariant("cpu")}
                      className="accent-primary-600"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <Cpu size={16} className="text-blue-500" />
                        <span className="font-medium">Nur CPU</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        ~200 MB Download – funktioniert auf jedem System
                      </p>
                    </div>
                  </label>
                </div>

                <button
                  onClick={installTorch}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 mt-2"
                >
                  <Download size={16} />
                  {torchInfo?.installed ? "PyTorch neu installieren" : "PyTorch installieren"}
                </button>
              </div>
            )}

            {/* Install Progress */}
            {installing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Loader size={16} className="animate-spin text-primary-500" />
                  <span>Installiere PyTorch ({torchVariant === "cuda" ? "CUDA" : "CPU"})...</span>
                </div>
                <div className="max-h-32 overflow-auto bg-slate-900 rounded p-3">
                  <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap">
                    {installLog || "Starte Installation..."}
                  </pre>
                </div>
                <p className="text-xs text-amber-500">
                  {torchVariant === "cuda"
                    ? "CUDA-Version ist ~2.5 GB – bitte Geduld."
                    : "Bitte warten..."}
                </p>
              </div>
            )}

            {/* Install Done */}
            {installDone && (
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle size={20} className="text-green-500" />
                <div>
                  <span className="text-green-700 dark:text-green-300 font-medium">
                    PyTorch installiert!
                  </span>
                  {torchInfo && (
                    <span className="text-xs text-slate-500 ml-2">
                      v{torchInfo.version} {torchInfo.cuda ? "(CUDA)" : "(CPU)"}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Qdrant prüfen</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Qdrant ist die Vektordatenbank für die semantische Suche.
            </p>
            <div className="flex items-center gap-3 p-4 bg-slate-100 dark:bg-slate-700 rounded-lg">
              {qdrantOk === null && !checking ? (
                <div className="w-5 h-5 rounded-full bg-slate-300 dark:bg-slate-500" />
              ) : checking ? (
                <Loader size={20} className="animate-spin text-blue-400" />
              ) : qdrantOk ? (
                <CheckCircle size={20} className="text-green-500" />
              ) : (
                <XCircle size={20} className="text-red-500" />
              )}
              <span>
                {checking
                  ? "Prüfe Qdrant..."
                  : qdrantOk === null
                  ? "Klicken Sie 'Prüfen' um Qdrant zu testen"
                  : qdrantOk
                  ? "Qdrant läuft auf Port 6333"
                  : "Qdrant nicht erreichbar"}
              </span>
            </div>
            <button
              onClick={checkQdrant}
              disabled={checking}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checking ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {checking ? "Prüfe..." : "Prüfen"}
            </button>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Backend starten</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Das Python-Backend lädt die Embedding- und Reranking-Modelle (~2 GB beim ersten Start).
            </p>

            {/* Fortschrittsanzeige */}
            {backend.isLoading && (
              <div className="space-y-3">
                <ProgressBar
                  progress={backend.status.loadingProgress}
                  total={100}
                  label={backend.status.loadingStage}
                />
                <p className="text-xs text-slate-400 text-center">
                  {backend.status.loadingProgress}%
                </p>
              </div>
            )}

            {backend.isReady && (
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle size={20} className="text-green-500" />
                <span className="text-green-700 dark:text-green-300">Backend bereit!</span>
              </div>
            )}

            {backend.isError && (
              <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <XCircle size={20} className="text-red-500" />
                <span className="text-red-700 dark:text-red-300">{backend.status.error}</span>
              </div>
            )}

            {!backend.isReady && !backend.isLoading && !backend.isError && (
              <button
                onClick={startBackend}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
              >
                Backend starten
              </button>
            )}

            {backend.isError && (
              <button
                onClick={startBackend}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
              >
                <RefreshCw size={16} />
                Erneut versuchen
              </button>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Gesetze indexieren</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Lädt alle Gesetze herunter und erstellt Embeddings. Dies dauert 5–15 Minuten.
            </p>
            {indexProgress && (
              <div className="space-y-2">
                <ProgressBar
                  progress={indexProgress.fortschritt}
                  total={indexProgress.gesamt}
                  label={indexProgress.nachricht}
                />
              </div>
            )}
            {!indexing && !indexDone && (
              <div className="flex gap-3">
                <button
                  onClick={startIndexing}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
                >
                  Indexierung starten
                </button>
                <button
                  onClick={() => { setIndexDone(true); }}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
                >
                  Überspringen
                </button>
              </div>
            )}
            {indexing && !indexDone && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Indexierung läuft... Bitte nicht schließen.
              </p>
            )}
            {indexDone && (
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                Indexierung abgeschlossen!
              </p>
            )}
          </div>
        );

      case 5:
        return (
          <div className="text-center space-y-4">
            <CheckCircle size={48} className="text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Einrichtung abgeschlossen!</h2>
            <p className="text-slate-500 dark:text-slate-400">
              Paragraf ist einsatzbereit. Viel Erfolg bei der Recherche!
            </p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-8">
        {/* Step indicators */}
        <div className="flex gap-1 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1 rounded-full ${
                i <= step
                  ? "bg-primary-500"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="min-h-[260px]">{renderStep()}</div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 whitespace-pre-line">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || installing}
            className="flex items-center gap-1 px-4 py-2 text-sm text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={16} />
            Zurück
          </button>

          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={installing}
              className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
            >
              Weiter
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 font-medium"
            >
              Suche starten!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
