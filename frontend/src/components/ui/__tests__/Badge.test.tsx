import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "../Badge";

describe("Badge", () => {
  it("renders a span element", () => {
    render(<Badge>Status</Badge>);
    const badge = screen.getByText("Status");
    expect(badge.tagName).toBe("SPAN");
  });

  it("applies default variant classes", () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText("Default");
    expect(badge.className).toContain("bg-slate-100");
  });

  it("applies primary variant", () => {
    render(<Badge variant="primary">Primary</Badge>);
    const badge = screen.getByText("Primary");
    expect(badge.className).toContain("bg-primary-50");
  });

  it("renders children text", () => {
    render(<Badge>Test Label</Badge>);
    expect(screen.getByText("Test Label")).toBeDefined();
  });
});
