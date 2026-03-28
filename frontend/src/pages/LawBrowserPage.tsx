import React, { useState, useEffect } from "react";
import {
  api,
  type LawInfo,
  type LawStructureEntry,
  type SearchResultItem,
} from "../lib/api";
import { ExportDropdown } from "../components/ExportDropdown";
import { type ExportData, DEFAULT_DISCLAIMER } from "../lib/export-types";
import { Loader, ChevronRight, ChevronDown, Library } from "lucide-react";

interface TreeNode {
  label: string;
  children: TreeNode[];
  entry?: LawStructureEntry;
  fullText?: string;
}

function buildTree(entries: LawStructureEntry[]): TreeNode[] {
  // Group by abschnitt
  const groups = new Map<string, LawStructureEntry[]>();
  for (const e of entries) {
    const key = e.abschnitt || "Sonstige";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  return Array.from(groups.entries()).map(([abschnitt, entries]) => ({
    label: abschnitt,
    children: entries.map((e) => ({
      label: `${e.paragraph}${e.titel ? ` – ${e.titel}` : ""}`,
      children: [],
      entry: e,
    })),
  }));
}

function TreeItem({
  node,
  onSelect,
  depth = 0,
}: {
  node: TreeNode;
  onSelect: (entry: LawStructureEntry) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children.length > 0;
  const isLeaf = !!node.entry;

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined} aria-level={depth + 1}>
      <button
        onClick={() => {
          if (isLeaf && node.entry) onSelect(node.entry);
          else setExpanded(!expanded);
        }}
        aria-label={isLeaf ? `${node.label} anzeigen` : `${node.label} ${expanded ? "zuklappen" : "aufklappen"}`}
        className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
          isLeaf ? "text-primary-600 dark:text-primary-400" : "font-medium text-slate-700 dark:text-slate-300"
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {hasChildren &&
          (expanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />)}
        {!hasChildren && <span className="w-3.5" aria-hidden="true" />}
        <span className="text-left flex-1 truncate">{node.label}</span>
      </button>
      {expanded && hasChildren && (
        <ul role="group">
          {node.children.map((child, i) => (
            <TreeItem
              key={i}
              node={child}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function LawBrowserPage() {
  const [laws, setLaws] = useState<LawInfo[]>([]);
  const [selectedLaw, setSelectedLaw] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedParagraph, setSelectedParagraph] = useState<SearchResultItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingParagraph, setLoadingParagraph] = useState(false);

  useEffect(() => {
    api.laws().then((res) => setLaws(res.gesetze)).catch(() => {});
  }, []);

  const loadStructure = async (gesetz: string) => {
    setSelectedLaw(gesetz);
    setSelectedParagraph(null);
    setLoading(true);
    try {
      const res = await api.lawStructure(gesetz);
      setTree(buildTree(res.paragraphen));
    } catch {
      setTree([]);
    } finally {
      setLoading(false);
    }
  };

  const loadParagraph = async (entry: LawStructureEntry) => {
    setLoadingParagraph(true);
    try {
      const res = await api.lookup({
        gesetz: selectedLaw!,
        paragraph: entry.paragraph,
      });
      if (res.found) {
        setSelectedParagraph({
          paragraph: res.paragraph,
          gesetz: res.gesetz,
          titel: res.titel,
          text: res.text,
          score: 0,
          abschnitt: res.abschnitt,
          hierarchie_pfad: res.hierarchie_pfad,
          quelle: res.quelle,
          chunk_typ: "paragraph",
          absatz: null,
        });
      }
    } catch {}
    setLoadingParagraph(false);
  };

  const lawBrowserToExportData = (): ExportData => ({
    title: "Gesetze",
    subtitle: selectedLaw ? `${selectedLaw}` : undefined,
    date: new Date().toLocaleDateString("de-DE"),
    items: selectedParagraph
      ? [{
          heading: `${selectedParagraph.gesetz} ${selectedParagraph.paragraph}`,
          subheading: selectedParagraph.titel || undefined,
          text: selectedParagraph.text,
        }]
      : [],
    disclaimer: DEFAULT_DISCLAIMER,
  });

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Left: Law list + tree */}
      <div className="w-72 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 overflow-auto">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h1 className="text-heading font-semibold flex items-center gap-2">
            <Library size={18} aria-hidden="true" />
            Gesetze
          </h1>
        </div>

        {!selectedLaw ? (
          <div className="py-1">
            {laws.map((law) => (
              <button
                key={law.abkuerzung}
                onClick={() => loadStructure(law.abkuerzung)}
                className="w-full text-left px-4 py-2.5 min-h-11 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="font-medium text-primary-600 dark:text-primary-400">
                  {law.abkuerzung}
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {law.beschreibung}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <button
              onClick={() => {
                setSelectedLaw(null);
                setTree([]);
                setSelectedParagraph(null);
              }}
              className="w-full text-left px-4 py-2 text-sm text-primary-600 dark:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-200 dark:border-slate-700"
            >
              <span aria-hidden="true">&larr;</span> Alle Gesetze
            </button>
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <span className="font-bold text-sm">{selectedLaw}</span>
            </div>
            {loading ? (
              <div className="flex justify-center py-8" role="status" aria-live="polite">
                <Loader className="animate-spin text-primary-500" size={20} aria-hidden="true" />
                <span className="sr-only">Struktur wird geladen...</span>
              </div>
            ) : (
              <ul role="tree" aria-label={`Struktur von ${selectedLaw}`} className="py-1">
                {tree.map((node, i) => (
                  <TreeItem
                    key={i}
                    node={node}
                    onSelect={loadParagraph}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Right: Content */}
      <div className="flex-1 overflow-auto p-6">
        {loadingParagraph && (
          <div className="flex justify-center py-12" role="status" aria-live="polite">
            <Loader className="animate-spin text-primary-500" size={24} aria-hidden="true" />
            <span className="sr-only">Paragraph wird geladen...</span>
          </div>
        )}

        {selectedParagraph && !loadingParagraph && (
          <div>
            <div className="flex items-start justify-between gap-2 mb-2">
              <h2 className="text-lg font-bold">
                {selectedParagraph.paragraph} {selectedParagraph.gesetz}
                {selectedParagraph.titel && (
                  <span className="font-normal text-neutral-500 dark:text-neutral-400">
                    {" "}&ndash; {selectedParagraph.titel}
                  </span>
                )}
              </h2>
              <ExportDropdown getData={lawBrowserToExportData} filename="paragraf-gesetze" />
            </div>
            {selectedParagraph.hierarchie_pfad && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                {selectedParagraph.hierarchie_pfad}
              </p>
            )}
            <pre className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
              {selectedParagraph.text}
            </pre>
          </div>
        )}

        {!selectedParagraph && !loadingParagraph && (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>Wählen Sie ein Gesetz und einen Paragraphen aus der Seitenleiste.</p>
          </div>
        )}
      </div>
    </div>
  );
}
