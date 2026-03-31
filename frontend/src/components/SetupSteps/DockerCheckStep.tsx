import React, { useEffect } from "react";
import { CheckCircle, AlertTriangle, XCircle, Loader } from "lucide-react";

interface DockerCheckStepProps {
  dockerResult: DockerCheckResult | null;
  onCheck: () => void;
  onDownload: () => void;
  onNext: () => void;
  onBack: () => void;
}

export function DockerCheckStep({
  dockerResult,
  onCheck,
  onDownload,
  onNext,
  onBack,
}: DockerCheckStepProps) {
  useEffect(() => {
    if (dockerResult === null) {
      onCheck();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isRunning = dockerResult?.status === "running";

  return (
    <div className="flex flex-col items-center px-8 py-10">
      <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
        Docker-Erkennung
      </h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8">
        Paragraf benötigt Docker Desktop, um die Backend-Dienste auszuführen.
      </p>

      <div className="w-full max-w-md mb-10" aria-live="polite">
        {/* Loading */}
        {dockerResult === null && (
          <div className="flex flex-col items-center gap-3 py-6" role="status">
            <Loader size={32} className="animate-spin text-primary-500" aria-hidden="true" />
            <p className="text-neutral-600 dark:text-neutral-300">Docker wird gesucht...</p>
          </div>
        )}

        {/* Running */}
        {dockerResult?.status === "running" && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-success-50 dark:bg-success-900/20 border border-success-500/30">
            <CheckCircle size={24} className="text-success-500 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-medium text-success-600 dark:text-success-500">
                Docker läuft
              </p>
              {dockerResult.version && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  Version: {dockerResult.version}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Not running */}
        {dockerResult?.status === "not-running" && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-warning-50 dark:bg-warning-100/10 border border-warning-500/30">
            <AlertTriangle size={24} className="text-warning-500 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-medium text-neutral-800 dark:text-neutral-200">
                Docker ist installiert, aber nicht gestartet
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                Bitte starten Sie Docker Desktop und klicken Sie &quot;Erneut prüfen&quot;.
              </p>
              <button
                onClick={onCheck}
                className="mt-3 px-4 py-1.5 rounded-lg border border-warning-500 text-warning-600 dark:text-warning-500 hover:bg-warning-50 dark:hover:bg-warning-100/10 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                Erneut prüfen
              </button>
            </div>
          </div>
        )}

        {/* Installed but CLI missing */}
        {dockerResult?.status === "installed" && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-warning-50 dark:bg-warning-100/10 border border-warning-500/30">
            <AlertTriangle size={24} className="text-warning-500 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-medium text-neutral-800 dark:text-neutral-200">
                Docker Desktop ist installiert, aber der CLI-Zugang fehlt
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                Bitte starten Sie Docker Desktop neu und starten Sie Paragraf neu.
              </p>
              <button
                onClick={onCheck}
                className="mt-3 px-4 py-1.5 rounded-lg border border-warning-500 text-warning-600 dark:text-warning-500 hover:bg-warning-50 dark:hover:bg-warning-100/10 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                Erneut prüfen
              </button>
            </div>
          </div>
        )}

        {/* Missing */}
        {dockerResult?.status === "missing" && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-500/30">
            <XCircle size={24} className="text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-medium text-neutral-800 dark:text-neutral-200">
                Docker wurde nicht gefunden
              </p>
              <button
                onClick={onDownload}
                className="mt-3 px-4 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                Docker Desktop herunterladen
              </button>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-3">
                Nach der Installation: Starten Sie Docker Desktop, dann klicken Sie &quot;Erneut prüfen&quot;.
              </p>
              <button
                onClick={onCheck}
                className="mt-2 px-4 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                Erneut prüfen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-5 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
        >
          Zurück
        </button>
        <button
          onClick={onNext}
          disabled={!isRunning}
          className="px-6 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
        >
          Weiter
        </button>
      </div>
    </div>
  );
}
