/**
 * Graph-Utils — d3-force Simulation, Canvas-Rendering und Hilfsfunktionen
 * fuer den interaktiven Zitationsgraph.
 */

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from "d3-force";
import type { Simulation, SimulationNodeDatum, SimulationLinkDatum } from "d3-force";

// ── Types ───────────────────────────────────────────────────────────────────

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  type: "law" | "paragraph";
  refCount: number;
  gesetz: string;
  paragraph?: string;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  kontext: string | null;
}

export interface Transform {
  x: number;
  y: number;
  k: number; // zoom scale
}

// ── Constants ───────────────────────────────────────────────────────────────

export const EDGE_COLORS = {
  light: {
    "i.V.m.": "#6366f1",
    "gemaess": "#22c55e",
    "nach": "#f59e0b",
    "siehe": "#64748b",
    "null": "#cbd5e1",
  },
  dark: {
    "i.V.m.": "#818cf8",
    "gemaess": "#4ade80",
    "nach": "#fbbf24",
    "siehe": "#94a3b8",
    "null": "#94a3b8",
  },
} as const;

export const KONTEXT_LABELS: Record<string, string> = {
  "i.V.m.": "in Verbindung mit",
  "gemaess": "gemaess",
  "nach": "nach",
  "siehe": "siehe auch",
};

// ── Functions ───────────────────────────────────────────────────────────────

/** Berechnet den Radius eines Knotens basierend auf Typ und Referenzanzahl. */
export function nodeRadius(node: GraphNode): number {
  if (node.type === "law") {
    return 24 + Math.min(node.refCount, 24);
  }
  return 16 + Math.min(node.refCount, 16);
}

/** Erstellt eine d3-force Simulation mit den gegebenen Knoten und Kanten. */
export function createSimulation(
  nodes: GraphNode[],
  links: GraphLink[],
  width: number,
  height: number,
): Simulation<GraphNode, GraphLink> {
  return forceSimulation<GraphNode>(nodes)
    .force(
      "link",
      forceLink<GraphNode, GraphLink>(links)
        .id((d) => d.id)
        .distance(80),
    )
    .force("charge", forceManyBody().strength(-200))
    .force("center", forceCenter(width / 2, height / 2))
    .force(
      "collide",
      forceCollide<GraphNode>().radius((d) => nodeRadius(d) + 5),
    )
    .alphaDecay(0.02);
}

/** Findet den Knoten an einer Canvas-Koordinate unter Beruecksichtigung der Transformation. */
export function findNodeAtPoint(
  canvasX: number,
  canvasY: number,
  nodes: GraphNode[],
  transform: Transform,
): GraphNode | null {
  // Convert canvas coords to simulation coords
  const simX = (canvasX - transform.x) / transform.k;
  const simY = (canvasY - transform.y) / transform.k;

  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;
    const dx = simX - node.x;
    const dy = simY - node.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= nodeRadius(node)) {
      return node;
    }
  }
  return null;
}

/** Zeichnet einen Pfeil mit Pfeilspitze. */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  targetRadius: number,
  color: string,
  width: number,
): void {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;

  const ux = dx / len;
  const uy = dy / len;

  // End point at the edge of target node
  const endX = toX - ux * targetRadius;
  const endY = toY - uy * targetRadius;

  // Draw line
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();

  // Draw arrowhead (8px)
  const headLen = 8;
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - headLen * ux + (headLen / 2) * uy,
    endY - headLen * uy - (headLen / 2) * ux,
  );
  ctx.lineTo(
    endX - headLen * ux - (headLen / 2) * uy,
    endY - headLen * uy + (headLen / 2) * ux,
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Zeichnet einen vollstaendigen Frame des Graphen auf das Canvas. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  nodes: GraphNode[],
  links: GraphLink[],
  transform: Transform,
  selectedNodeId: string | null,
  hoveredNodeId: string | null,
  isDark: boolean,
): void {
  const w = ctx.canvas.width / (window.devicePixelRatio || 1);
  const h = ctx.canvas.height / (window.devicePixelRatio || 1);

  // Clear canvas
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.k, transform.k);

  // Draw dot grid background (20px intervals)
  const gridColor = isDark ? "#404040" : "#d4d4d8";
  const gridStep = 20;
  const startX = Math.floor(-transform.x / transform.k / gridStep) * gridStep - gridStep;
  const startY = Math.floor(-transform.y / transform.k / gridStep) * gridStep - gridStep;
  const endX = startX + w / transform.k + gridStep * 2;
  const endY = startY + h / transform.k + gridStep * 2;

  ctx.fillStyle = gridColor;
  for (let gx = startX; gx < endX; gx += gridStep) {
    for (let gy = startY; gy < endY; gy += gridStep) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw edges
  const colors = isDark ? EDGE_COLORS.dark : EDGE_COLORS.light;
  for (const link of links) {
    const source = link.source as GraphNode;
    const target = link.target as GraphNode;
    if (source.x == null || source.y == null || target.x == null || target.y == null) continue;

    const colorKey = (link.kontext ?? "null") as keyof typeof colors;
    const color = colors[colorKey] || colors["null"];
    const tRadius = nodeRadius(target);

    drawArrow(ctx, source.x, source.y, target.x, target.y, tRadius, color, 1.5);
  }

  // Draw nodes
  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;
    const r = nodeRadius(node);
    const isSelected = node.id === selectedNodeId;
    const isHovered = node.id === hoveredNodeId;

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);

    if (isSelected) {
      ctx.fillStyle = isDark ? "#818cf8" : "#6366f1";
      ctx.strokeStyle = isDark ? "#c7d2fe" : "#4338ca";
      ctx.lineWidth = 3;
    } else if (isHovered) {
      ctx.fillStyle = isDark ? "#4b5563" : "#e5e7eb";
      ctx.strokeStyle = isDark ? "#818cf8" : "#6366f1";
      ctx.lineWidth = 2;
    } else {
      ctx.fillStyle = isDark ? "#374151" : "#f3f4f6";
      ctx.strokeStyle = isDark ? "#6b7280" : "#d1d5db";
      ctx.lineWidth = 1.5;
    }
    ctx.fill();
    ctx.stroke();

    // Node label
    ctx.fillStyle = isDark ? "#e5e7eb" : "#1f2937";
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.label, node.x, node.y);
  }

  ctx.restore();
}

/** Aggregiert Paragraph-Referenzen zu Gesetz-Level-Kanten. */
export function buildLawLevelGraph(
  lawRefs: Map<string, { outgoing: { gesetz: string; kontext: string | null }[] }>,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodeMap = new Map<string, GraphNode>();
  const linkSet = new Set<string>();
  const links: GraphLink[] = [];

  // Ensure all source laws exist as nodes
  for (const [lawId, refs] of lawRefs) {
    if (!nodeMap.has(lawId)) {
      nodeMap.set(lawId, {
        id: lawId,
        label: lawId,
        type: "law",
        refCount: 0,
        gesetz: lawId,
      });
    }
    // Count outgoing references
    const node = nodeMap.get(lawId)!;
    node.refCount += refs.outgoing.length;

    for (const ref of refs.outgoing) {
      // Ensure target law node exists
      if (!nodeMap.has(ref.gesetz)) {
        nodeMap.set(ref.gesetz, {
          id: ref.gesetz,
          label: ref.gesetz,
          type: "law",
          refCount: 0,
          gesetz: ref.gesetz,
        });
      }

      // Create link key for deduplication per unique (source, target, kontext) triple
      const kontextKey = ref.kontext ?? "null";
      const linkKey = `${lawId}->${ref.gesetz}::${kontextKey}`;
      if (!linkSet.has(linkKey)) {
        linkSet.add(linkKey);
        links.push({
          source: lawId,
          target: ref.gesetz,
          kontext: ref.kontext,
        });
      }
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    links,
  };
}
