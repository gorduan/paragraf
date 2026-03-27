import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { Input } from "../Input";

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input aria-label="test" />);
    expect(screen.getByRole("textbox")).toBeDefined();
  });

  it("applies default variant border", () => {
    render(<Input aria-label="test" />);
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("border-slate-200");
  });

  it("applies error variant border", () => {
    render(<Input variant="error" aria-label="test" />);
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("border-error-500");
  });

  it("forwards ref correctly", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} aria-label="test" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("has displayName set to Input", () => {
    expect(Input.displayName).toBe("Input");
  });
});
