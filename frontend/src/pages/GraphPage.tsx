/**
 * GraphPage — Interaktiver Zitationsgraph mit Dual-Level-Toggle,
 * Pan/Zoom/Drag, Seitenpanel und progressivem Laden.
 */

import { useState, useEffect, useCallback, useContext } from "react";
import { Loader, AlertCircle, RefreshCw } from "lucide-react";
import { ThemeContext } from "@/App";
import { api } from "@/lib/api";
import { ExportDropdown } from "@/components/ExportDropdown";
import { type ExportData, DEFAULT_DISCLAIMER } from "@/lib/export-types";
import type { ReferenceNetworkResponse, IndexStatusItem } from "@/lib/api";
import {
  buildLawLevelGraph,
  type GraphNode,
  type GraphLink,
} from "@/lib/graph-utils";
import { GraphCanvas } from "@/components/GraphCanvas";
import { GraphSidePanel } from "@/components/GraphSidePanel";
import { GraphLegend } from "@/components/GraphLegend";
import { Button } from "@/components/ui/Button";

// ── Types ───────────────────────────────────────────────────────────────────

type GraphLevel = "laws" | "paragraphs";

interface GraphPageProps {
  onPageChange?: (page: string) => void;
}

// ── Helper: batch promises ──────────────────────────────────────────────────

async function batchedFetch<T>(
  tasks: (() => Promise<T>)[],
  batchSize: number,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((fn) => fn()));
    results.push(...batchResults);
  }
  return results;
}

// ── Component ───────────────────────────────────────────────────────────────

export function GraphPage({ onPageChange }: GraphPageProps) {
  const { dark } = useContext(ThemeContext);

  const [level, setLevel] = useState<GraphLevel>("laws");
  const [focusedLaw, setFocusedLaw] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [nodeRefs, setNodeRefs] = useState<ReferenceNetworkResponse | null>(null);
  const [nodeRefsLoading, setNodeRefsLoading] = useState(false);
  const [allNodes, setAllNodes] = useState<GraphNode[]>([]);
  const [allLinks, setAllLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

  // Visible subset for progressive loading
  const visibleNodes = allNodes.slice(0, visibleCount);
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
  const visibleLinks = allLinks.filter(
    (l) => {
      const srcId = typeof l.source === "string" ? l.source : l.source.id;
      const tgtId = typeof l.target === "string" ? l.target : l.target.id;
      return visibleNodeIds.has(srcId) && visibleNodeIds.has(tgtId);
    },
  );

  // ── Law-Level Data Loading ──────────────────────────────────────────────

  const loadLawLevelGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusResponse = await api.indexStatus();
      const indexedLaws = statusResponse.gesetze.filter(
        (l: IndexStatusItem) => l.status === "indexiert" && l.chunks > 0,
      );

      if (indexedLaws.length === 0) {
        setAllNodes([]);
        setAllLinks([]);
        setLoading(false);
        return;
      }

      // Fetch structure for each law to get paragraph lists
      const structureTasks = indexedLaws.slice(0, 50).map(
        (law: IndexStatusItem) => () => api.lawStructure(law.gesetz).catch(() => null),
      );
      const structures = await batchedFetch(structureTasks, 10);

      // For each law, sample first 3 paragraphs and fetch references
      const lawRefs = new Map<string, { outgoing: { gesetz: string; kontext: string | null }[] }>();

      const refTasks: (() => Promise<void>)[] = [];
      for (let i = 0; i < structures.length; i++) {
        const structure = structures[i];
        if (!structure) continue;
        const law = indexedLaws[i];
        const paragraphs = structure.paragraphen.slice(0, 5);

        for (const p of paragraphs) {
          refTasks.push(async () => {
            try {
              const refs = await api.references(law.gesetz, p.paragraph);
              if (!lawRefs.has(law.gesetz)) {
                lawRefs.set(law.gesetz, { outgoing: [] });
              }
              const existing = lawRefs.get(law.gesetz)!;
              for (const outRef of refs.outgoing) {
                existing.outgoing.push({
                  gesetz: outRef.gesetz,
                  kontext: outRef.kontext,
                });
              }
            } catch {
              // Skip failed reference fetches
            }
          });
        }
      }

      await batchedFetch(refTasks, 10);

      const { nodes, links } = buildLawLevelGraph(lawRefs);
      setAllNodes(nodes);
      setAllLinks(links);
    } catch (e: any) {
      setError(e.message || "Zitationsgraph konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Paragraph-Level Data Loading ────────────────────────────────────────

  const loadParagraphLevelGraph = useCallback(async (gesetz: string) => {
    setLoading(true);
    setError(null);
    try {
      const structure = await api.lawStructure(gesetz);
      const paragraphs = structure.paragraphen;

      const nodes: GraphNode[] = paragraphs.map((p) => ({
        id: `${gesetz}:${p.paragraph}`,
        label: p.paragraph,
        type: "paragraph" as const,
        refCount: 0,
        gesetz,
        paragraph: p.paragraph,
      }));

      const links: GraphLink[] = [];
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      // Fetch references for each paragraph
      const refTasks = paragraphs.map(
        (p) => async () => {
          try {
            const refs = await api.references(gesetz, p.paragraph);
            const nodeId = `${gesetz}:${p.paragraph}`;
            const node = nodeMap.get(nodeId);
            if (node) node.refCount = refs.outgoing.length + refs.incoming_count;

            for (const outRef of refs.outgoing) {
              const targetId = `${outRef.gesetz}:${outRef.paragraph}`;
              // Add target node if within same law and not already existing
              if (outRef.gesetz === gesetz && !nodeMap.has(targetId)) {
                const newNode: GraphNode = {
                  id: targetId,
                  label: outRef.paragraph,
                  type: "paragraph",
                  refCount: 0,
                  gesetz: outRef.gesetz,
                  paragraph: outRef.paragraph,
                };
                nodeMap.set(targetId, newNode);
                nodes.push(newNode);
              }
              if (nodeMap.has(targetId)) {
                links.push({
                  source: nodeId,
                  target: targetId,
                  kontext: outRef.kontext,
                });
              }
            }
          } catch {
            // Skip failed reference fetches
          }
        },
      );

      await batchedFetch(refTasks, 10);

      setAllNodes(nodes);
      setAllLinks(links);
    } catch (e: any) {
      setError(e.message || "Paragraphen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Initial Load ────────────────────────────────────────────────────────

  useEffect(() => {
    loadLawLevelGraph();
  }, [loadLawLevelGraph]);

  // ── Node Click Handler ──────────────────────────────────────────────────

  const handleNodeClick = useCallback(
    async (node: GraphNode) => {
      setSelectedNode(node);
      setNodeRefsLoading(true);
      setNodeRefs(null);

      if (node.paragraph) {
        try {
          const refs = await api.references(node.gesetz, node.paragraph);
          setNodeRefs(refs);
        } catch {
          setNodeRefs(null);
        } finally {
          setNodeRefsLoading(false);
        }
      } else {
        // Law-level node: no individual paragraph refs, just show node info
        setNodeRefsLoading(false);
      }
    },
    [],
  );

  // ── Navigation Handler ──────────────────────────────────────────────────

  const handleNavigate = useCallback(
    (gesetz: string, paragraph: string) => {
      // Navigate to LookupPage via onPageChange
      if (onPageChange) {
        onPageChange("lookup");
      }
    },
    [onPageChange],
  );

  // ── Level Toggle ────────────────────────────────────────────────────────

  const handleLevelChange = useCallback(
    (newLevel: GraphLevel) => {
      setLevel(newLevel);
      setSelectedNode(null);
      setNodeRefs(null);
      setVisibleCount(50);

      if (newLevel === "laws") {
        setFocusedLaw(null);
        loadLawLevelGraph();
      } else if (newLevel === "paragraphs" && focusedLaw) {
        loadParagraphLevelGraph(focusedLaw);
      }
    },
    [focusedLaw, loadLawLevelGraph, loadParagraphLevelGraph],
  );

  const handleDrillDown = useCallback(
    (lawId: string) => {
      setFocusedLaw(lawId);
      setLevel("paragraphs");
      setSelectedNode(null);
      setNodeRefs(null);
      setVisibleCount(50);
      loadParagraphLevelGraph(lawId);
    },
    [loadParagraphLevelGraph],
  );

  // ── Export helper ──────────────────────────────────────────────────────

  const graphToExportData = useCallback((): ExportData => ({
    title: "Zitationsgraph",
    subtitle: focusedLaw ? `${focusedLaw} — Paragraphen` : "Gesetze-Ebene",
    date: new Date().toLocaleDateString("de-DE"),
    items: visibleNodes.map((n) => ({
      heading: n.label,
      text: `Knoten im Zitationsgraph (${n.refCount} Referenzen)`,
      metadata: n.gesetz ? { Gesetz: n.gesetz } : undefined,
    })),
    disclaimer: DEFAULT_DISCLAIMER,
  }), [visibleNodes, focusedLaw]);

  // ── Render ──────────────────────────────────────────────────────────────

  // Empty state
  if (!loading && !error && allNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertCircle size={48} className="text-neutral-300 dark:text-neutral-600 mb-4" aria-hidden="true" />
        <h2 className="text-heading font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
          Keine Querverweise vorhanden
        </h2>
        <p className="text-body text-neutral-500 dark:text-neutral-400 max-w-md">
          Indexieren Sie zuerst Gesetze mit Querverweisen, um den Zitationsgraph zu sehen.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center gap-4">
        <h1 className="text-heading font-semibold text-neutral-900 dark:text-neutral-100">
          Zitationsgraph
        </h1>

        {/* Level toggle */}
        <div
          role="radiogroup"
          aria-label="Graph-Ebene"
          className="flex bg-neutral-100 dark:bg-neutral-800 rounded-md p-0.5"
        >
          <button
            role="radio"
            aria-checked={level === "laws"}
            onClick={() => handleLevelChange("laws")}
            className={`px-3 py-1 text-caption font-semibold rounded transition-colors ${
              level === "laws"
                ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            Gesetze
          </button>
          <button
            role="radio"
            aria-checked={level === "paragraphs"}
            onClick={() => handleLevelChange("paragraphs")}
            className={`px-3 py-1 text-caption font-semibold rounded transition-colors ${
              level === "paragraphs"
                ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            Paragraphen
          </button>
        </div>

        {focusedLaw && level === "paragraphs" && (
          <span className="text-caption text-neutral-500 dark:text-neutral-400">
            {focusedLaw}
          </span>
        )}

        <div className="ml-auto">
          <ExportDropdown getData={graphToExportData} filename="paragraf-graph" />
        </div>
      </div>

      {/* Paragraph-level message when no law focused */}
      {level === "paragraphs" && !focusedLaw && !loading && (
        <div className="flex items-center justify-center flex-1 p-8 text-center">
          <p className="text-body text-neutral-500 dark:text-neutral-400">
            Klicken Sie auf ein Gesetz, um dessen Paragraphen zu sehen.
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <Loader size={28} className="animate-spin text-primary-500" aria-hidden="true" />
          <span className="text-body text-neutral-500 dark:text-neutral-400">
            Lade Zitationsnetzwerk...
          </span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 p-8 text-center">
          <AlertCircle size={32} className="text-error-500" aria-hidden="true" />
          <p className="text-body text-neutral-700 dark:text-neutral-300">
            Zitationsgraph konnte nicht geladen werden. Bitte versuchen Sie es erneut.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (level === "laws") loadLawLevelGraph();
              else if (focusedLaw) loadParagraphLevelGraph(focusedLaw);
            }}
          >
            <RefreshCw size={14} className="mr-1" aria-hidden="true" />
            Erneut versuchen
          </Button>
        </div>
      )}

      {/* Graph area */}
      {!loading && !error && allNodes.length > 0 && (level === "laws" || focusedLaw) && (
        <div className="flex flex-1 min-h-0">
          {/* Canvas area */}
          <div className="flex-1 relative">
            <GraphCanvas
              nodes={visibleNodes}
              links={visibleLinks}
              selectedNodeId={selectedNode?.id ?? null}
              onNodeClick={(node) => {
                handleNodeClick(node);
              }}
              onNodeHover={() => {}}
              isDark={dark}
            />

            <GraphLegend isDark={dark} />

            {/* Progressive loading button */}
            {visibleCount < allNodes.length && (
              <div className="absolute bottom-4 right-4 z-10">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setVisibleCount((c) => c + 50)}
                >
                  Weitere Knoten laden ({allNodes.length - visibleCount} verbleibend)
                </Button>
              </div>
            )}
          </div>

          {/* Side panel */}
          <GraphSidePanel
            node={selectedNode}
            referenceData={nodeRefs}
            loading={nodeRefsLoading}
            onClose={() => {
              setSelectedNode(null);
              setNodeRefs(null);
            }}
            onNavigate={handleNavigate}
            onDrillDown={handleDrillDown}
          />
        </div>
      )}
    </div>
  );
}
