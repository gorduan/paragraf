import { describe, it, expect } from "vitest";
import {
  createSimulation,
  nodeRadius,
  buildLawLevelGraph,
  findNodeAtPoint,
  EDGE_COLORS,
  KONTEXT_LABELS,
  type GraphNode,
  type GraphLink,
  type Transform,
} from "./graph-utils";

describe("graph-utils", () => {
  // Test 1: createSimulation returns a d3 simulation with positioned nodes
  it("createSimulation returns simulation with positioned nodes after ticking", () => {
    const nodes: GraphNode[] = [
      { id: "BGB", label: "BGB", type: "law", refCount: 5, gesetz: "BGB" },
      { id: "SGB IX", label: "SGB IX", type: "law", refCount: 3, gesetz: "SGB IX" },
    ];
    const links: GraphLink[] = [
      { source: "BGB", target: "SGB IX", kontext: "gemaess" },
    ];

    const sim = createSimulation(nodes, links, 800, 600);
    // Tick the simulation to let it settle
    sim.tick(50);

    expect(nodes[0].x).toBeDefined();
    expect(nodes[0].y).toBeDefined();
    expect(nodes[1].x).toBeDefined();
    expect(nodes[1].y).toBeDefined();
    // Nodes should have numeric coordinates
    expect(typeof nodes[0].x).toBe("number");
    expect(typeof nodes[0].y).toBe("number");

    sim.stop();
  });

  // Test 2: GraphNode and GraphLink types are correctly structured
  it("GraphNode and GraphLink types accept correct structure", () => {
    const node: GraphNode = {
      id: "BGB",
      label: "BGB",
      type: "law",
      refCount: 10,
      gesetz: "BGB",
      paragraph: "§ 823",
    };
    expect(node.id).toBe("BGB");
    expect(node.type).toBe("law");
    expect(node.paragraph).toBe("§ 823");

    const link: GraphLink = {
      source: "BGB",
      target: "SGB IX",
      kontext: "i.V.m.",
    };
    expect(link.source).toBe("BGB");
    expect(link.kontext).toBe("i.V.m.");
  });

  // Test 3: nodeRadius returns larger radius for nodes with higher refCount
  it("nodeRadius returns larger radius for higher refCount", () => {
    const smallNode: GraphNode = {
      id: "a", label: "a", type: "law", refCount: 0, gesetz: "A",
    };
    const largeNode: GraphNode = {
      id: "b", label: "b", type: "law", refCount: 30, gesetz: "B",
    };
    const paraNode: GraphNode = {
      id: "c", label: "c", type: "paragraph", refCount: 5, gesetz: "C", paragraph: "§ 1",
    };

    const smallR = nodeRadius(smallNode);
    const largeR = nodeRadius(largeNode);
    const paraR = nodeRadius(paraNode);

    // Law nodes: base 24, max 24+24=48
    expect(smallR).toBe(24);
    expect(largeR).toBe(48); // 24 + min(30, 24) = 48
    // Paragraph nodes: base 16
    expect(paraR).toBe(21); // 16 + min(5, 16) = 21
  });

  // Test 4: EDGE_COLORS maps all 5 kontext types for both themes
  it("EDGE_COLORS maps all 5 kontext types for both light and dark themes", () => {
    const kontextTypes = ["i.V.m.", "gemaess", "nach", "siehe", "null"] as const;

    for (const k of kontextTypes) {
      expect(EDGE_COLORS.light[k]).toBeDefined();
      expect(EDGE_COLORS.dark[k]).toBeDefined();
      expect(typeof EDGE_COLORS.light[k]).toBe("string");
      expect(typeof EDGE_COLORS.dark[k]).toBe("string");
    }

    // Verify specific colors from UI-SPEC
    expect(EDGE_COLORS.light["i.V.m."]).toBe("#6366f1");
    expect(EDGE_COLORS.light["gemaess"]).toBe("#22c55e");
    expect(EDGE_COLORS.dark["i.V.m."]).toBe("#818cf8");
  });

  // Test 5: buildLawLevelGraph aggregates paragraph-level references into law-level edges
  it("buildLawLevelGraph aggregates paragraph-level references into law-level edges", () => {
    const lawRefs = new Map<string, { outgoing: { gesetz: string; kontext: string | null }[] }>();
    lawRefs.set("BGB", {
      outgoing: [
        { gesetz: "SGB IX", kontext: "gemaess" },
        { gesetz: "SGB IX", kontext: "gemaess" },  // duplicate should be deduplicated
        { gesetz: "StGB", kontext: "nach" },
      ],
    });
    lawRefs.set("SGB IX", {
      outgoing: [
        { gesetz: "BGB", kontext: "i.V.m." },
      ],
    });

    const { nodes, links } = buildLawLevelGraph(lawRefs);

    // Should have 3 law nodes: BGB, SGB IX, StGB
    expect(nodes).toHaveLength(3);
    expect(nodes.map((n) => n.id).sort()).toEqual(["BGB", "SGB IX", "StGB"]);

    // All nodes should be type "law"
    for (const n of nodes) {
      expect(n.type).toBe("law");
    }

    // BGB has 3 outgoing refs, SGB IX has 1
    const bgb = nodes.find((n) => n.id === "BGB");
    expect(bgb?.refCount).toBe(3);

    // Links: BGB->SGB IX (gemaess), BGB->StGB (nach), SGB IX->BGB (i.V.m.)
    expect(links).toHaveLength(3);

    const bgbToSgb = links.find(
      (l) => l.source === "BGB" && l.target === "SGB IX" && l.kontext === "gemaess"
    );
    expect(bgbToSgb).toBeDefined();
  });

  // Test 6: findNodeAtPoint returns node at given coordinates
  it("findNodeAtPoint returns node when point is within radius", () => {
    const nodes: GraphNode[] = [
      { id: "BGB", label: "BGB", type: "law", refCount: 0, gesetz: "BGB", x: 100, y: 100 },
      { id: "StGB", label: "StGB", type: "law", refCount: 0, gesetz: "StGB", x: 300, y: 300 },
    ];
    const transform: Transform = { x: 0, y: 0, k: 1 };

    // Click right on first node
    const found = findNodeAtPoint(100, 100, nodes, transform);
    expect(found?.id).toBe("BGB");

    // Click far away from any node
    const notFound = findNodeAtPoint(500, 500, nodes, transform);
    expect(notFound).toBeNull();
  });

  // Test 7: KONTEXT_LABELS has all context labels
  it("KONTEXT_LABELS maps context types to German labels", () => {
    expect(KONTEXT_LABELS["i.V.m."]).toBe("in Verbindung mit");
    expect(KONTEXT_LABELS["gemaess"]).toBe("gemaess");
    expect(KONTEXT_LABELS["nach"]).toBe("nach");
    expect(KONTEXT_LABELS["siehe"]).toBe("siehe auch");
  });
});
