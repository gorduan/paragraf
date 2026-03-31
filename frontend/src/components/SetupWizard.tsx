import React, { useState, useCallback } from "react";
import { Check } from "lucide-react";
import { WelcomeStep } from "./SetupSteps/WelcomeStep";
import { ModeStep } from "./SetupSteps/ModeStep";
import { DockerCheckStep } from "./SetupSteps/DockerCheckStep";
import { StorageStep } from "./SetupSteps/StorageStep";
import { ModelDownloadStep } from "./SetupSteps/ModelDownloadStep";
import { GpuDetectionStep } from "./SetupSteps/GpuDetectionStep";
import { SummaryStep } from "./SetupSteps/SummaryStep";

// ── Step Definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { id: "welcome", label: "Willkommen" },
  { id: "mode", label: "Modus" },
  { id: "docker", label: "Docker" },
  { id: "storage", label: "Speicher" },
  { id: "download", label: "Modelle" },
  { id: "gpu", label: "GPU" },
  { id: "summary", label: "Fertig" },
] as const;

// ── Props ────────────────────────────────────────────────────────────────────

interface SetupWizardProps {
  initialStep: number;
  onComplete: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function SetupWizard({ initialStep, onComplete }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [dockerResult, setDockerResult] = useState<DockerCheckResult | null>(null);
  const [storageEstimate, setStorageEstimate] = useState<ParagrafStorageEstimate | null>(null);

  const goNext = useCallback(() => {
    const nextStep = currentStep + 1;
    if (nextStep < STEPS.length) {
      setCurrentStep(nextStep);
      window.paragrafSetup?.setSetupStep(nextStep);
    }
  }, [currentStep]);

  const goBack = useCallback(() => {
    const prevStep = Math.max(0, currentStep - 1);
    setCurrentStep(prevStep);
    window.paragrafSetup?.setSetupStep(prevStep);
  }, [currentStep]);

  const handleCheckDocker = useCallback(async () => {
    setDockerResult(null);
    const result = await window.paragrafSetup?.checkDocker();
    if (result) setDockerResult(result);
  }, []);

  const handleDownloadDocker = useCallback(() => {
    window.paragrafSetup?.openDockerDownload();
  }, []);

  const handleLoadStorage = useCallback(async () => {
    const estimate = await window.paragrafSetup?.getStorageEstimate();
    if (estimate) setStorageEstimate(estimate);
  }, []);

  // Start Docker before the download step so the backend is available
  const [dockerStarted, setDockerStarted] = useState(false);
  const goNextWithDocker = useCallback(async () => {
    if (!dockerStarted) {
      await window.paragrafSetup?.startDocker();
      setDockerStarted(true);
    }
    goNext();
  }, [goNext, dockerStarted]);

  const handleComplete = useCallback(async () => {
    await window.paragrafSetup?.completeSetup();
    // Docker already started before download step; restart only if not running
    if (!dockerStarted) {
      await window.paragrafSetup?.startDocker();
    }
    onComplete();
  }, [onComplete, dockerStarted]);

  // ── Stepper UI ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Stepper */}
        <nav className="flex items-center justify-center gap-2 mb-8" aria-label="Setup-Fortschritt">
          {STEPS.map((step, idx) => {
            const isComplete = idx < currentStep;
            const isCurrent = idx === currentStep;

            return (
              <React.Fragment key={step.id}>
                {idx > 0 && (
                  <div
                    className={`h-0.5 w-8 sm:w-12 transition-colors ${
                      isComplete ? "bg-primary-500" : "bg-neutral-300 dark:bg-neutral-700"
                    }`}
                    aria-hidden="true"
                  />
                )}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      isComplete
                        ? "bg-primary-500 text-white"
                        : isCurrent
                          ? "bg-primary-500 text-white ring-2 ring-primary-500/30"
                          : "bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
                    }`}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {isComplete ? (
                      <Check size={16} aria-hidden="true" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={`text-xs hidden sm:block ${
                      isCurrent
                        ? "text-primary-600 dark:text-primary-400 font-medium"
                        : "text-neutral-400 dark:text-neutral-500"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Step Content */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-800">
          {currentStep === 0 && <WelcomeStep onNext={goNext} />}
          {currentStep === 1 && <ModeStep onNext={goNext} onBack={goBack} />}
          {currentStep === 2 && (
            <DockerCheckStep
              dockerResult={dockerResult}
              onCheck={handleCheckDocker}
              onDownload={handleDownloadDocker}
              onNext={goNext}
              onBack={goBack}
            />
          )}
          {currentStep === 3 && (
            <StorageStep
              storageEstimate={storageEstimate}
              onLoad={handleLoadStorage}
              onNext={goNextWithDocker}
              onBack={goBack}
            />
          )}
          {currentStep === 4 && (
            <ModelDownloadStep onNext={goNext} onBack={goBack} />
          )}
          {currentStep === 5 && (
            <GpuDetectionStep onNext={goNext} onBack={goBack} />
          )}
          {currentStep === 6 && (
            <SummaryStep
              dockerResult={dockerResult}
              onComplete={handleComplete}
              onBack={goBack}
            />
          )}
        </div>
      </div>
    </div>
  );
}
