import React from "react";
import { Scale } from "lucide-react";

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-8 py-12">
      {/* Logo / Icon Bereich */}
      <div className="w-20 h-20 rounded-2xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center mb-8">
        <Scale size={40} className="text-primary-500" aria-hidden="true" />
      </div>

      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
        Willkommen bei Paragraf
      </h1>
      <p className="text-lg text-neutral-500 dark:text-neutral-400 mb-4">
        Deutsches Recht &ndash; schnell und verständlich
      </p>
      <p className="text-sm text-neutral-400 dark:text-neutral-500 max-w-md mb-10">
        Paragraf hilft Ihnen, relevante Paragraphen in Sekunden zu finden.
        Dieser Assistent richtet die App für Sie ein.
      </p>

      <button
        onClick={onNext}
        className="px-6 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
      >
        Weiter
      </button>
    </div>
  );
}
