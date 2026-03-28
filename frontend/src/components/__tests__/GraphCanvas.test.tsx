import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock graph-utils before importing GraphCanvas
vi.mock("@/lib/graph-utils", () => ({
  createSimulation: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    tick: vi.fn(),
    stop: vi.fn(),
    alphaTarget: vi.fn().mockReturnThis(),
    restart: vi.fn(),
  })),
  drawFrame: vi.fn(),
  findNodeAtPoint: vi.fn(() => null),
  nodeRadius: vi.fn(() => 24),
  EDGE_COLORS: {
    light: { "i.V.m.": "#6366f1", "gemaess": "#22c55e", "nach": "#f59e0b", "siehe": "#64748b", "null": "#cbd5e1" },
    dark: { "i.V.m.": "#818cf8", "gemaess": "#4ade80", "nach": "#fbbf24", "siehe": "#94a3b8", "null": "#94a3b8" },
  },
}));

import { GraphCanvas } from "../GraphCanvas";

// Mock canvas context
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fillText: vi.fn(),
    canvas: { width: 800, height: 600 },
  })) as any;
});

describe("GraphCanvas", () => {
  const defaultProps = {
    nodes: [],
    links: [],
    selectedNodeId: null,
    onNodeClick: vi.fn(),
    onNodeHover: vi.fn(),
    isDark: false,
  };

  it("renders a canvas element without crashing", () => {
    render(<GraphCanvas {...defaultProps} />);
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeTruthy();
  });

  it("canvas has correct role='img' and aria-label attributes", () => {
    render(
      <GraphCanvas
        {...defaultProps}
        nodes={[
          { id: "BGB", label: "BGB", type: "law", refCount: 0, gesetz: "BGB" },
          { id: "StGB", label: "StGB", type: "law", refCount: 0, gesetz: "StGB" },
        ]}
      />,
    );
    const canvas = document.querySelector("canvas");
    expect(canvas?.getAttribute("role")).toBe("img");
    expect(canvas?.getAttribute("aria-label")).toBe(
      "Interaktiver Zitationsgraph mit 2 Knoten",
    );
  });

  it("canvas has tabindex for keyboard accessibility", () => {
    render(<GraphCanvas {...defaultProps} />);
    const canvas = document.querySelector("canvas");
    expect(canvas?.getAttribute("tabindex")).toBe("0");
  });
});
