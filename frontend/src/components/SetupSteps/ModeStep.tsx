import React from "react";
import { Container, Cpu } from "lucide-react";

interface ModeStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function ModeStep({ onNext, onBack }: ModeStepProps) {
  return (
    <div className="flex flex-col items-center px-8 py-10">
      <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
        Installationsmodus
      </h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8">
        Wählen Sie, wie Paragraf ausgeführt werden soll.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg mb-10">
        {/* Docker Card (enabled, pre-selected) */}
        <div
          className="relative rounded-xl border-2 border-primary-500 bg-white dark:bg-neutral-800 p-5 cursor-pointer ring-2 ring-primary-500/30 shadow-sm transition-shadow hover:shadow-md"
          role="radio"
          aria-checked="true"
          tabIndex={0}
        >
          <span className="absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-success-100 text-success-600 dark:bg-success-900 dark:text-success-500">
            Empfohlen
          </span>
          <Container size={28} className="text-primary-500 mb-3" aria-hidden="true" />
          <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">
            Docker
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Alle Dienste laufen in Docker-Containern. Einfachste Einrichtung.
          </p>
        </div>

        {/* Native Card (disabled) */}
        <div
          className="relative rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 opacity-50 cursor-not-allowed"
          aria-disabled="true"
          role="radio"
          aria-checked="false"
          tabIndex={-1}
        >
          <div className="absolute inset-0 rounded-xl bg-neutral-100/60 dark:bg-neutral-900/60 flex items-center justify-center z-10">
            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 bg-white dark:bg-neutral-800 px-3 py-1 rounded-lg shadow-sm">
              Kommt in Version 2.1
            </span>
          </div>
          <Cpu size={28} className="text-neutral-400 mb-3" aria-hidden="true" />
          <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">
            Nativ
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Python und Qdrant direkt auf dem System.
          </p>
        </div>
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
