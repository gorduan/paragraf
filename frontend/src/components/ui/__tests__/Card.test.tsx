import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "../Card";

describe("Card", () => {
  it("renders children content", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeDefined();
  });

  it("applies default variant classes", () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId("card");
    expect(card.className).toContain("shadow-md");
    expect(card.className).toContain("rounded-md");
  });

  it("applies interactive variant with hover classes", () => {
    render(<Card variant="interactive" data-testid="card">Content</Card>);
    const card = screen.getByTestId("card");
    expect(card.className).toContain("hover:shadow-lg");
    expect(card.className).toContain("cursor-pointer");
  });

  it("merges custom className", () => {
    render(<Card className="my-card" data-testid="card">Content</Card>);
    const card = screen.getByTestId("card");
    expect(card.className).toContain("my-card");
  });
});
