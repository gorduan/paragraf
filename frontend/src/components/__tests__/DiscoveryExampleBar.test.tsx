import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { DiscoveryExampleBar, type DiscoveryExample } from "../DiscoveryExampleBar";
import { UndoSnackbar } from "../UndoSnackbar";

function makeExample(overrides: Partial<DiscoveryExample> = {}): DiscoveryExample {
  return {
    paragraph: "§ 823",
    gesetz: "BGB",
    titel: "Schadensersatzpflicht",
    polarity: "positive",
    ...overrides,
  };
}

describe("DiscoveryExampleBar", () => {
  const defaultProps = {
    examples: [] as DiscoveryExample[],
    onRemove: vi.fn(),
    onExecute: vi.fn(),
    onReset: vi.fn(),
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders positive chips with '+' prefix in green styling", () => {
    const examples = [makeExample({ polarity: "positive" })];
    render(<DiscoveryExampleBar {...defaultProps} examples={examples} />);

    const chip = screen.getByLabelText("Beispiel entfernen: § 823 BGB");
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain("+");
    expect(chip.className).toContain("bg-success-50");
  });

  it("renders negative chips with '-' prefix in red styling", () => {
    const examples = [makeExample({ polarity: "negative" })];
    render(<DiscoveryExampleBar {...defaultProps} examples={examples} />);

    const chip = screen.getByLabelText("Beispiel entfernen: § 823 BGB");
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain("-");
    expect(chip.className).toContain("bg-error-50");
  });

  it("calls onRemove with correct example when X is clicked", () => {
    const example = makeExample();
    const onRemove = vi.fn();
    render(<DiscoveryExampleBar {...defaultProps} examples={[example]} onRemove={onRemove} />);

    fireEvent.click(screen.getByLabelText("Beispiel entfernen: § 823 BGB"));
    expect(onRemove).toHaveBeenCalledWith(example);
  });

  it("disables 'Entdecken' button when no positive examples exist", () => {
    const examples = [makeExample({ polarity: "negative" })];
    render(<DiscoveryExampleBar {...defaultProps} examples={examples} />);

    const button = screen.getByRole("button", { name: /Entdecken/i });
    expect(button).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables 'Entdecken' button when at least 1 positive example exists", () => {
    const examples = [makeExample({ polarity: "positive" })];
    render(<DiscoveryExampleBar {...defaultProps} examples={examples} />);

    const button = screen.getByRole("button", { name: /Entdecken/i });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it("'Zuruecksetzen' link calls onReset", () => {
    const onReset = vi.fn();
    const examples = [makeExample()];
    render(<DiscoveryExampleBar {...defaultProps} examples={examples} onReset={onReset} />);

    fireEvent.click(screen.getByText("Zuruecksetzen"));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe("UndoSnackbar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders message and 'Rueckgaengig' button", () => {
    render(
      <UndoSnackbar
        message="Beispiele entfernt"
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByText("Beispiele entfernt")).toBeTruthy();
    expect(screen.getByText("Rueckgaengig")).toBeTruthy();
  });

  it("auto-dismisses after timeout", () => {
    const onDismiss = vi.fn();
    render(
      <UndoSnackbar
        message="Beispiele entfernt"
        onUndo={vi.fn()}
        onDismiss={onDismiss}
        duration={5000}
      />
    );

    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
