import React, { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Loader,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
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

  const steps = [
    "Willkommen",
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

  const checkBackendHealth = async () => {
    setError(null);
    try {
      await api.health();
      return true;
    } catch {
      setError("Backend ist noch nicht bereit. Bitte warten...");
      return false;
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
              Paragraf durchsucht 18 deutsche Gesetze mit semantischer Suche.
              Dieser Assistent hilft Ihnen bei der Ersteinrichtung.
            </p>
            <div className="text-sm text-slate-400 space-y-1">
              <p>Voraussetzungen:</p>
              <ul className="list-disc list-inside">
                <li>Qdrant (läuft auf Port 6333)</li>
                <li>Internetverbindung (Modelle + Gesetze laden)</li>
                <li>~2 GB Speicherplatz (Modelle)</li>
              </ul>
            </div>
          </div>
        );

      case 1:
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

      case 2:
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

      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Gesetze indexieren</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Lädt alle 18 Gesetze herunter und erstellt Embeddings. Dies dauert 5–15 Minuten.
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

      case 4:
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
        <div className="min-h-[200px]">{renderStep()}</div>

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
            disabled={step === 0}
            className="flex items-center gap-1 px-4 py-2 text-sm text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={16} />
            Zurück
          </button>

          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
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
