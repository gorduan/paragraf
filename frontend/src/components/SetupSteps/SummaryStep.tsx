import React from "react";
import { CheckCircle, XCircle } from "lucide-react";

interface SummaryStepProps {
  dockerResult: DockerCheckResult | null;
  onComplete: () => void;
  onBack: () => void;
}

function dockerStatusText(result: DockerCheckResult | null): string {
  if (!result) return "Nicht geprueft";
  switch (result.status) {
    case "running":
      return `Laeuft${result.version ? ` (${result.version})` : ""}`;
    case "not-running":
      return "Installiert, aber nicht gestartet";
    case "installed":
      return "Installiert, CLI fehlt";
    case "missing":
      return "Nicht gefunden";
  }
}

export function SummaryStep({ dockerResult, onComplete, onBack }: SummaryStepProps) {
  const dockerOk = dockerResult?.status === "running";

  return (
    <div className="flex flex-col items-center px-8 py-10">
      <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
        Zusammenfassung
      </h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8">
        Alles bereit. Pruefen Sie die Einstellungen und starten Sie Paragraf.
      </p>

      <div className="w-full max-w-md mb-10 space-y-3">
        {/* Mode */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
          <CheckCircle size={20} className="text-success-500 shrink-0" aria-hidden="true" />
          <span className="text-sm text-neutral-700 dark:text-neutral-300">
            Installationsmodus: <strong>Docker</strong>
          </span>
        </div>

        {/* Docker status */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
          {dockerOk ? (
            <CheckCircle size={20} className="text-success-500 shrink-0" aria-hidden="true" />
          ) : (
            <XCircle size={20} className="text-red-500 shrink-0" aria-hidden="true" />
          )}
          <span className="text-sm text-neutral-700 dark:text-neutral-300">
            Docker: <strong>{dockerStatusText(dockerResult)}</strong>
          </span>
        </div>

        {/* Storage */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
          <CheckCircle size={20} className="text-success-500 shrink-0" aria-hidden="true" />
          <span className="text-sm text-neutral-700 dark:text-neutral-300">
            Speicherbedarf: <strong>~8,5 GB</strong>
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-5 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
        >
          Zurueck
        </button>
        <button
          onClick={onComplete}
          className="px-6 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
        >
          Einrichtung abschliessen
        </button>
      </div>
    </div>
  );
}
