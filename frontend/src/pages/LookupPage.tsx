import React, { useState, useEffect } from "react";
import { api, type LookupResponse, type LawInfo, type ReferenceItem } from "../lib/api";
import { parseCitations } from "../lib/citation-parser";
import { CitationTooltip } from "../components/CitationTooltip";
import { Disclaimer } from "../components/Disclaimer";
import { Loader, BookOpen } from "lucide-react";

export function LookupPage() {
  const [gesetz, setGesetz] = useState("SGB IX");
  const [paragraph, setParagraph] = useState("");
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [laws, setLaws] = useState<LawInfo[]>([]);
  const [refs, setRefs] = useState<ReferenceItem[]>([]);
  const [pendingLookup, setPendingLookup] = useState(0);

  useEffect(() => {
    api.laws().then((res) => setLaws(res.gesetze)).catch(() => {});
  }, []);

  // Group laws by rechtsgebiet
  const groupedLaws = laws.reduce<Record<string, LawInfo[]>>((acc, law) => {
    const group = law.rechtsgebiet || "Sonstiges";
    if (!acc[group]) acc[group] = [];
    acc[group].push(law);
    return acc;
  }, {});

  const handleLookup = async () => {
    if (!paragraph.trim()) return;
    setLoading(true);
    setError(null);
    setRefs([]);
    try {
      // Normalize paragraph input
      let p = paragraph.trim();
      if (!p.startsWith("§") && !p.startsWith("Art")) p = `§ ${p}`;
      const res = await api.lookup({ gesetz, paragraph: p });
      setResult(res);

      // Fetch citation network data for this paragraph
      if (res.found) {
        api
          .references(gesetz, p)
          .then((refRes) => setRefs(refRes.outgoing))
          .catch(() => {});
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger lookup when navigating from a citation link
  useEffect(() => {
    if (pendingLookup > 0) {
      handleLookup();
    }
  }, [pendingLookup]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Paragraph nachschlagen</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Direkter Zugriff auf einen bestimmten Paragraphen
        </p>
      </div>

      <fieldset className="flex gap-3">
        <legend className="sr-only">Paragraph nachschlagen</legend>
        <div>
          <label htmlFor="lookup-law" className="sr-only">Gesetz auswaehlen</label>
          <select
            id="lookup-law"
            value={gesetz}
            onChange={(e) => setGesetz(e.target.value)}
            className="px-3 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {Object.entries(groupedLaws).map(([group, groupLaws]) => (
              <optgroup key={group} label={group}>
                {groupLaws.map((law) => (
                  <option key={law.abkuerzung} value={law.abkuerzung}>
                    {law.abkuerzung}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="relative flex-1">
          <BookOpen size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <label htmlFor="lookup-paragraph" className="sr-only">Paragraphen-Nummer</label>
          <input
            id="lookup-paragraph"
            type="text"
            value={paragraph}
            onChange={(e) => setParagraph(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            placeholder="§-Nummer oder Art.-Nummer, z.B. 152 oder Art. 5"
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <button
          onClick={handleLookup}
          disabled={!paragraph.trim()}
          aria-disabled={!paragraph.trim()}
          className="px-5 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Nachschlagen
        </button>
      </fieldset>

      {loading && (
        <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
          <Loader className="animate-spin text-primary-500" size={24} aria-hidden="true" />
          <span className="sr-only">Paragraph wird geladen...</span>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {result && !loading && (
        <div className="mt-6">
          {result.found ? (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
              <h2 className="text-lg font-bold">
                {result.paragraph} {result.gesetz}
                {result.titel && (
                  <span className="font-normal text-slate-500 dark:text-slate-400">
                    {" "}&ndash; {result.titel}
                  </span>
                )}
              </h2>

              {result.hierarchie_pfad && (
                <p className="text-xs text-slate-400 mt-1">
                  {result.hierarchie_pfad}
                </p>
              )}
              {result.abschnitt && (
                <p className="text-xs text-slate-400">
                  Abschnitt: {result.abschnitt}
                </p>
              )}
              {result.stand && (
                <p className="text-xs text-slate-400">Stand: {result.stand}</p>
              )}

              <hr className="my-4 border-slate-200 dark:border-slate-700" />

              <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                {parseCitations(result.text, refs).map((segment, i) =>
                  segment.type === "text" ? (
                    <span key={i}>{segment.content}</span>
                  ) : (
                    <CitationTooltip
                      key={i}
                      reference={segment.reference!}
                      onNavigate={(g, p) => {
                        setGesetz(g);
                        setParagraph(p);
                        setResult(null);
                        setRefs([]);
                        setPendingLookup((c) => c + 1);
                      }}
                    />
                  )
                )}
              </div>

              <p className="text-xs text-slate-400 mt-4">
                Quelle: {result.quelle}
              </p>
              <Disclaimer />
            </div>
          ) : (
            <div className="p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-amber-800 dark:text-amber-200">
                {result.error || "Paragraph nicht gefunden."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
