import React, { useEffect } from "react";
import { HardDrive } from "lucide-react";

interface StorageStepProps {
  storageEstimate: StorageEstimate | null;
  onLoad: () => void;
  onNext: () => void;
  onBack: () => void;
}

function formatMB(mb: number): string {
  if (mb >= 1000) return `~${(mb / 1000).toFixed(1)} GB`;
  return `~${mb} MB`;
}

export function StorageStep({ storageEstimate, onLoad, onNext, onBack }: StorageStepProps) {
  useEffect(() => {
    if (storageEstimate === null) {
      onLoad();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center px-8 py-10">
      <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
        Speicherbedarf
      </h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8">
        Paragraf benötigt etwa 8,5 GB Speicherplatz.
      </p>

      <div className="w-full max-w-md mb-8">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-neutral-100 dark:border-neutral-700">
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                  <HardDrive size={16} className="inline mr-2 text-neutral-400" aria-hidden="true" />
                  Docker-Images
                </td>
                <td className="px-4 py-3 text-right font-medium text-neutral-800 dark:text-neutral-200">
                  {storageEstimate ? formatMB(storageEstimate.dockerImages) : "~4 GB"}
                </td>
              </tr>
              <tr className="border-b border-neutral-100 dark:border-neutral-700">
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                  ML-Modelle (bge-m3 + Reranker)
                </td>
                <td className="px-4 py-3 text-right font-medium text-neutral-800 dark:text-neutral-200">
                  {storageEstimate ? formatMB(storageEstimate.mlModels) : "~4 GB"}
                </td>
              </tr>
              <tr className="border-b border-neutral-100 dark:border-neutral-700">
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                  Rechtsdaten
                </td>
                <td className="px-4 py-3 text-right font-medium text-neutral-800 dark:text-neutral-200">
                  {storageEstimate ? formatMB(storageEstimate.lawData) : "~500 MB"}
                </td>
              </tr>
              <tr className="bg-neutral-50 dark:bg-neutral-900/50">
                <td className="px-4 py-3 font-semibold text-neutral-900 dark:text-white">
                  Gesamt
                </td>
                <td className="px-4 py-3 text-right font-bold text-primary-600 dark:text-primary-400">
                  {storageEstimate ? formatMB(storageEstimate.total) : "~8.5 GB"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-4">
          Die ML-Modelle werden beim ersten Start heruntergeladen.
          Dies kann je nach Internetverbindung einige Minuten dauern.
        </p>

        {storageEstimate?.modelCachePath && (
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
            Modell-Cache: <code className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1 rounded">{storageEstimate.modelCachePath}</code>
          </p>
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
          className="px-6 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
        >
          Weiter
        </button>
      </div>
    </div>
  );
}
