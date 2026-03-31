import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSetup: ParagrafSetup = {
  getSetupState: vi.fn().mockResolvedValue({
    setupComplete: false,
    setupStep: 0,
    selectedMode: "docker" as const,
    dockerDetected: false,
    estimatedStorage: 0,
  }),
  setSetupStep: vi.fn().mockResolvedValue(true),
  checkDocker: vi.fn().mockResolvedValue({ status: "running", version: "24.0.0" }),
  openDockerDownload: vi.fn().mockResolvedValue(true),
  completeSetup: vi.fn().mockResolvedValue(true),
  getStorageEstimate: vi.fn().mockResolvedValue({
    dockerImages: 4000,
    mlModels: 4000,
    lawData: 500,
    total: 8500,
    unit: "MB",
    modelCachePath: "C:\\ProgramData\\Paragraf\\models",
  }),
  startDocker: vi.fn().mockResolvedValue({ success: true }),
};

beforeEach(() => {
  window.paragrafSetup = mockSetup;
  window.paragrafDesktop = { isDesktop: true, getDockerStatus: vi.fn(), restartDocker: vi.fn() };
});

afterEach(() => {
  delete window.paragrafSetup;
  delete window.paragrafDesktop;
  vi.restoreAllMocks();
});

// ── Step Rendering ───────────────────────────────────────────────────────────

describe("SetupWizard", () => {
  it("renders stepper with 5 steps and current step highlighted", async () => {
    const { SetupWizard } = await import("../components/SetupWizard");
    render(<SetupWizard initialStep={0} onComplete={vi.fn()} />);

    expect(screen.getByText("Willkommen")).toBeTruthy();
    expect(screen.getByText("Modus")).toBeTruthy();
    expect(screen.getByText("Docker")).toBeTruthy();
    expect(screen.getByText("Speicher")).toBeTruthy();
    expect(screen.getByText("Fertig")).toBeTruthy();
  });
});

// ── WelcomeStep ──────────────────────────────────────────────────────────────

describe("WelcomeStep", () => {
  it("renders heading and Weiter button", async () => {
    const { WelcomeStep } = await import("../components/SetupSteps/WelcomeStep");
    const onNext = vi.fn();
    render(<WelcomeStep onNext={onNext} />);

    expect(screen.getByText("Willkommen bei Paragraf")).toBeTruthy();
    const btn = screen.getByRole("button", { name: /weiter/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onNext).toHaveBeenCalledOnce();
  });
});

// ── ModeStep ─────────────────────────────────────────────────────────────────

describe("ModeStep", () => {
  it("renders Docker card with Empfohlen badge and Native card as disabled", async () => {
    const { ModeStep } = await import("../components/SetupSteps/ModeStep");
    render(<ModeStep onNext={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText("Empfohlen")).toBeTruthy();
    // Docker card title (exact match to avoid matching description text)
    expect(screen.getByRole("radio", { checked: true })).toBeTruthy();

    const nativeCard = screen.getByText(/Nativ/).closest("[aria-disabled]");
    expect(nativeCard).toBeTruthy();
    expect(nativeCard?.getAttribute("aria-disabled")).toBe("true");

    expect(screen.getByText(/Kommt in Version 2\.1/)).toBeTruthy();
  });
});

// ── DockerCheckStep ──────────────────────────────────────────────────────────

describe("DockerCheckStep", () => {
  it("shows 'Docker läuft' for running status", async () => {
    const { DockerCheckStep } = await import("../components/SetupSteps/DockerCheckStep");
    render(
      <DockerCheckStep
        dockerResult={{ status: "running", version: "24.0.0" }}
        onCheck={vi.fn()}
        onDownload={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText(/Docker läuft/)).toBeTruthy();
  });

  it("shows warning for not-running status", async () => {
    const { DockerCheckStep } = await import("../components/SetupSteps/DockerCheckStep");
    render(
      <DockerCheckStep
        dockerResult={{ status: "not-running" }}
        onCheck={vi.fn()}
        onDownload={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText(/Docker ist installiert, aber nicht gestartet/)).toBeTruthy();
  });

  it("shows error for missing status", async () => {
    const { DockerCheckStep } = await import("../components/SetupSteps/DockerCheckStep");
    render(
      <DockerCheckStep
        dockerResult={{ status: "missing" }}
        onCheck={vi.fn()}
        onDownload={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText(/Docker wurde nicht gefunden/)).toBeTruthy();
  });
});

// ── Step Navigation ──────────────────────────────────────────────────────────

describe("SetupWizard navigation", () => {
  it("advances to next step when Weiter is clicked", async () => {
    const { SetupWizard } = await import("../components/SetupWizard");
    render(<SetupWizard initialStep={0} onComplete={vi.fn()} />);

    // On step 0 (Welcome), click Weiter
    const weiterBtn = screen.getByRole("button", { name: /weiter/i });
    fireEvent.click(weiterBtn);

    // Should now show ModeStep content
    await waitFor(() => {
      expect(screen.getByText("Empfohlen")).toBeTruthy();
    });
  });

  it("goes back when Zurück is clicked", async () => {
    const { SetupWizard } = await import("../components/SetupWizard");
    render(<SetupWizard initialStep={1} onComplete={vi.fn()} />);

    // On step 1 (Mode), click Zurück
    const backBtn = screen.getByRole("button", { name: /zurück/i });
    fireEvent.click(backBtn);

    // Should now show WelcomeStep
    await waitFor(() => {
      expect(screen.getByText("Willkommen bei Paragraf")).toBeTruthy();
    });
  });
});

// ── First-Run Detection ──────────────────────────────────────────────────────

describe("App first-run detection", () => {
  it("renders SetupWizard when setupComplete is false in desktop mode", async () => {
    (mockSetup.getSetupState as ReturnType<typeof vi.fn>).mockResolvedValue({
      setupComplete: false,
      setupStep: 0,
      selectedMode: "docker",
      dockerDetected: false,
      estimatedStorage: 0,
    });

    // Dynamic import so mocks are applied
    const { default: App } = await import("../App");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Willkommen bei Paragraf")).toBeTruthy();
    });
  });

  it("renders main app when setupComplete is true", async () => {
    (mockSetup.getSetupState as ReturnType<typeof vi.fn>).mockResolvedValue({
      setupComplete: true,
      setupStep: 4,
      selectedMode: "docker",
      dockerDetected: true,
      estimatedStorage: 8500,
    });

    const { default: App } = await import("../App");
    render(<App />);

    await waitFor(() => {
      // Main app has the sidebar with page navigation
      expect(screen.queryByText("Willkommen bei Paragraf")).toBeNull();
    });
  });
});
