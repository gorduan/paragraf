/**
 * GraphCanvas — Interaktives HTML5 Canvas mit d3-force Physik-Simulation.
 * Unterstuetzt Pan, Zoom, Drag und Node-Click-Erkennung.
 */

import { useRef, useEffect, useCallback } from "react";
import type { Simulation } from "d3-force";
import {
  createSimulation,
  drawFrame,
  findNodeAtPoint,
  type GraphNode,
  type GraphLink,
  type Transform,
} from "@/lib/graph-utils";

// ── Props ───────────────────────────────────────────────────────────────────

interface GraphCanvasProps {
  nodes: GraphNode[];
  links: GraphLink[];
  selectedNodeId: string | null;
  onNodeClick: (node: GraphNode) => void;
  onNodeHover: (node: GraphNode | null) => void;
  isDark: boolean;
}

// ── Component ───────────────────────────────────────────────────────────────

export function GraphCanvas({
  nodes,
  links,
  selectedNodeId,
  onNodeClick,
  onNodeHover,
  isDark,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 });
  const rafRef = useRef<number>(0);
  const hoveredRef = useRef<string | null>(null);

  // Drag state
  const dragRef = useRef<{
    node: GraphNode;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // Pan state
  const panRef = useRef<{ startX: number; startY: number; txStart: number; tyStart: number } | null>(null);

  // Track whether mouse moved during mousedown (to distinguish click from drag)
  const movedRef = useRef(false);

  // ── DPI Scaling ─────────────────────────────────────────────────────────

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  // ── Render Loop ─────────────────────────────────────────────────────────

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawFrame(
      ctx,
      nodes,
      links,
      transformRef.current,
      selectedNodeId,
      hoveredRef.current,
      isDark,
    );
    rafRef.current = requestAnimationFrame(render);
  }, [nodes, links, selectedNodeId, isDark]);

  // ── Simulation Setup ────────────────────────────────────────────────────

  useEffect(() => {
    if (nodes.length === 0) return;

    setupCanvas();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    // Center transform
    transformRef.current = { x: 0, y: 0, k: 1 };

    const sim = createSimulation(nodes, links, rect.width, rect.height);
    simRef.current = sim;

    sim.on("tick", () => {
      // Render is driven by rAF, triggered on tick
    });

    // Start render loop
    rafRef.current = requestAnimationFrame(render);

    const handleResize = () => {
      setupCanvas();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      sim.stop();
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, [nodes, links, setupCanvas, render]);

  // ── Mouse Event Handlers ────────────────────────────────────────────────

  const getCanvasCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasCoords(e);
      movedRef.current = false;

      const node = findNodeAtPoint(x, y, nodes, transformRef.current);
      if (node) {
        // Start node drag
        const simX = (x - transformRef.current.x) / transformRef.current.k;
        const simY = (y - transformRef.current.y) / transformRef.current.k;
        dragRef.current = {
          node,
          offsetX: (node.x ?? 0) - simX,
          offsetY: (node.y ?? 0) - simY,
        };
        node.fx = node.x;
        node.fy = node.y;
        simRef.current?.alphaTarget(0.3).restart();
      } else {
        // Start pan
        panRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          txStart: transformRef.current.x,
          tyStart: transformRef.current.y,
        };
      }
    },
    [nodes, getCanvasCoords],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasCoords(e);

      if (dragRef.current) {
        movedRef.current = true;
        const simX = (x - transformRef.current.x) / transformRef.current.k;
        const simY = (y - transformRef.current.y) / transformRef.current.k;
        dragRef.current.node.fx = simX + dragRef.current.offsetX;
        dragRef.current.node.fy = simY + dragRef.current.offsetY;
        return;
      }

      if (panRef.current) {
        movedRef.current = true;
        transformRef.current.x =
          panRef.current.txStart + (e.clientX - panRef.current.startX);
        transformRef.current.y =
          panRef.current.tyStart + (e.clientY - panRef.current.startY);
        return;
      }

      // Hover detection
      const hovered = findNodeAtPoint(x, y, nodes, transformRef.current);
      const newId = hovered?.id ?? null;
      if (newId !== hoveredRef.current) {
        hoveredRef.current = newId;
        onNodeHover(hovered);
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.style.cursor = hovered ? "pointer" : "grab";
        }
      }
    },
    [nodes, getCanvasCoords, onNodeHover],
  );

  const handleMouseUp = useCallback(() => {
    if (dragRef.current) {
      if (!movedRef.current) {
        // Was a click, not a drag
        onNodeClick(dragRef.current.node);
      }
      dragRef.current.node.fx = null;
      dragRef.current.node.fy = null;
      dragRef.current = null;
      simRef.current?.alphaTarget(0);
    }
    if (panRef.current) {
      panRef.current = null;
    }
  }, [onNodeClick]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);
    const t = transformRef.current;
    const direction = e.deltaY > 0 ? -1 : 1;
    const factor = 1 + direction * 0.1;
    const newK = Math.max(0.3, Math.min(3.0, t.k * factor));

    // Zoom toward mouse position
    t.x = x - (x - t.x) * (newK / t.k);
    t.y = y - (y - t.y) * (newK / t.k);
    t.k = newK;
  }, [getCanvasCoords]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ cursor: "grab" }}
      role="img"
      aria-label={`Interaktiver Zitationsgraph mit ${nodes.length} Knoten`}
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    />
  );
}
