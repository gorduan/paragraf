import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  api,
  type IndexStatusItem,
  type IndexProgressEvent,
  type LawInfo,
} from "../lib/api";
import { ProgressBar } from "../components/ProgressBar";
import {
  Loader,
  Database,
  RefreshCw,
  CheckCircle,
  XCircle,
  Download,
  Square,
  CheckSquare,
  MinusSquare,
} from "lucide-react";

export function IndexPage() {
  const [statusItems, setStatusItems] = useState<IndexStatusItem[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [dbStatus, setDbStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [indexing, setIndexing] = useState(false);
  const [indexingGesetz, setIndexingGesetz] = useState<string | null>(null);
  const [progress, setProgress] = useState<IndexProgressEvent | null>(null);
  const [eutbLoading, setEutbLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [laws, setLaws] = useState<LawInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [queue, setQueue] = useState<string[]>([]);
  const [queuePos, setQueuePos] = useState(0);
  const [indexLog, setIndexLog] = useState<string[]>([]);
  const cancelRef = useRef<(() => void) | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const [statusRes, lawsRes] = await Promise.all([
        api.indexStatus(),
        api.laws(),
      ]);
      setStatusItems(statusRes.gesetze);
      setTotalChunks(statusRes.total_chunks);
      setDbStatus(statusRes.db_status);
      setLaws(lawsRes.gesetze);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // Process queue: index one law at a time
  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setIndexLog((prev) => [...prev, `[${ts}] ${msg}`]);
  }, []);

  const indexNext = useCallback((q: string[], pos: number) => {
    if (pos >= q.length) {
      setIndexing(false);
      setIndexingGesetz(null);
      setQueue([]);
      setQueuePos(0);
      addLog(`=== Indexierung abgeschlossen (${q.length} Gesetze) ===`);
      loadStatus();
      return;
    }

    const name = q[pos];
    setIndexingGesetz(name);
    setProgress(null);
    addLog(`[${pos + 1}/${q.length}] Starte ${name}...`);

    let gotTerminalEvent = false;

    const { cancel } = api.indexGesetze(
      { gesetzbuch: name },
      (event) => {
        setProgress({ ...event, fortschritt: pos, gesamt: q.length });

        if (event.schritt === "embedding") {
          addLog(`${name}: ${event.nachricht}`);
        }
        if (event.schritt === "error") {
          gotTerminalEvent = true;
          addLog(`${name}: FEHLER – ${event.nachricht}`);
          setError((prev) => {
            const msg = `${name}: ${event.nachricht}`;
            return prev ? `${prev}\n${msg}` : msg;
          });
        }
        if (event.schritt === "done") {
          gotTerminalEvent = true;
          addLog(`${name}: ${event.nachricht}`);
        }
      },
      // onStreamEnd: called when SSE stream closes (even without done/error)
      (_lastEvent) => {
        if (!gotTerminalEvent) {
          addLog(`${name}: Stream unerwartet beendet (kein done/error Event)`);
          setError((prev) => {
            const msg = `${name}: Stream abgebrochen`;
            return prev ? `${prev}\n${msg}` : msg;
          });
        }
        setQueuePos(pos + 1);
        indexNext(q, pos + 1);
      },
    );
    cancelRef.current = cancel;
  }, []);

  const startSelectedIndex = () => {
    if (selected.size === 0) return;
    const q = Array.from(selected);
    setQueue(q);
    setQueuePos(0);
    setIndexing(true);
    setError(null);
    setIndexLog([]);
    setSelected(new Set());
    indexNext(q, 0);
  };

  const cancelIndex = () => {
    cancelRef.current?.();
    setIndexing(false);
    setIndexingGesetz(null);
    setQueue([]);
    setQueuePos(0);
    loadStatus();
  };

  const indexEutb = async () => {
    setEutbLoading(true);
    setError(null);
    try {
      const res = await api.indexEutb();
      if (!res.erfolg) {
        setError(res.fehler.join(", "));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setEutbLoading(false);
    }
  };

  // Selection helpers
  const toggleSelect = (abk: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(abk)) next.delete(abk);
      else next.add(abk);
      return next;
    });
  };

  const toggleGroup = (groupLaws: LawInfo[]) => {
    const abks = groupLaws.map((l) => l.abkuerzung);
    const allSelected = abks.every((a) => selected.has(a));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        abks.forEach((a) => next.delete(a));
      } else {
        abks.forEach((a) => next.add(a));
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === laws.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(laws.map((l) => l.abkuerzung)));
    }
  };

  const selectNotIndexed = () => {
    const statusMap = new Map(statusItems.map((s) => [s.gesetz, s]));
    const notIndexed = laws
      .filter((l) => (statusMap.get(l.abkuerzung)?.chunks ?? 0) === 0)
      .map((l) => l.abkuerzung);
    setSelected(new Set(notIndexed));
  };

  // Build a lookup map for status items
  const statusMap = new Map(statusItems.map((s) => [s.gesetz, s]));

  // Group laws by rechtsgebiet
  const groupedLaws = laws.reduce<Record<string, LawInfo[]>>((acc, law) => {
    const group = law.rechtsgebiet || "Sonstiges";
    if (!acc[group]) acc[group] = [];
    acc[group].push(law);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database size={24} aria-hidden="true" />
            Index-Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {totalChunks.toLocaleString()} Chunks indexiert &middot; DB-Status:{" "}
            {dbStatus} &middot; {laws.length} Gesetze
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadStatus}
            disabled={loading || indexing}
            className="flex items-center gap-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} aria-hidden="true" />
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Selection toolbar */}
      {!indexing && !loading && (
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <button
            onClick={selectAll}
            className="text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            {selected.size === laws.length ? "Keine" : "Alle"} auswaehlen
          </button>
          <button
            onClick={selectNotIndexed}
            className="text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Nicht-indexierte auswaehlen
          </button>
          {selected.size > 0 && (
            <button
              onClick={startSelectedIndex}
              className="flex items-center gap-1 px-4 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium"
            >
              <Download size={14} aria-hidden="true" />
              {selected.size} ausgewaehlte indexieren
            </button>
          )}
          {selected.size > 0 && (
            <span className="text-xs text-slate-400">
              {selected.size} ausgewaehlt
            </span>
          )}
        </div>
      )}

      {/* Progress */}
      {indexing && progress && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">
              Indexierung: {indexingGesetz}
              {queue.length > 1 && (
                <span className="text-slate-400 font-normal ml-2">
                  ({queuePos + 1}/{queue.length})
                </span>
              )}
            </p>
            <button
              onClick={cancelIndex}
              className="text-xs text-red-500 hover:text-red-700 hover:underline"
            >
              Abbrechen
            </button>
          </div>
          <ProgressBar
            progress={progress.fortschritt}
            total={progress.gesamt}
            label={progress.nachricht}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 whitespace-pre-line">
          {error}
          <button
            onClick={() => setError(null)}
            aria-label="Fehlermeldung schliessen"
            className="ml-2 text-red-400 hover:text-red-600 text-xs"
          >
            Schliessen
          </button>
        </div>
      )}

      {/* Index Log */}
      {indexLog.length > 0 && (
        <div className="mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Indexierungs-Log ({indexLog.length} Einträge)
            </h3>
            {!indexing && (
              <button
                onClick={() => setIndexLog([])}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Leeren
              </button>
            )}
          </div>
          <div className="p-3 max-h-48 overflow-auto" role="log" aria-live="polite" aria-label="Indexierungs-Protokoll">
            <pre className="text-xs text-slate-500 dark:text-slate-400 font-mono whitespace-pre-wrap">
              {indexLog.join("\n")}
            </pre>
          </div>
        </div>
      )}

      {/* Table grouped by Rechtsgebiet */}
      {loading ? (
        <div className="flex justify-center py-12" role="status" aria-live="polite">
          <Loader className="animate-spin text-primary-500" size={24} aria-hidden="true" />
          <span className="sr-only">Index-Status wird geladen...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedLaws).map(([group, groupLaws]) => {
            const groupAbks = groupLaws.map((l) => l.abkuerzung);
            const allGroupSelected = groupAbks.every((a) => selected.has(a));
            const someGroupSelected = groupAbks.some((a) => selected.has(a));

            return (
              <div
                key={group}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
              >
                <div
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 cursor-pointer select-none"
                  onClick={() => !indexing && toggleGroup(groupLaws)}
                  role={!indexing ? "checkbox" : undefined}
                  aria-checked={allGroupSelected ? true : someGroupSelected ? "mixed" : false}
                  aria-label={`${group} – alle ${groupLaws.length} Gesetze auswaehlen`}
                  tabIndex={!indexing ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (!indexing && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      toggleGroup(groupLaws);
                    }
                  }}
                >
                  {!indexing && (
                    <span className="text-slate-400" aria-hidden="true">
                      {allGroupSelected ? (
                        <CheckSquare size={16} />
                      ) : someGroupSelected ? (
                        <MinusSquare size={16} />
                      ) : (
                        <Square size={16} />
                      )}
                    </span>
                  )}
                  <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {group}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      ({groupLaws.length})
                    </span>
                  </h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700">
                      {!indexing && <th className="w-8 px-2 py-2"><span className="sr-only">Auswahl</span></th>}
                      <th className="text-left px-4 py-2 font-medium text-xs text-slate-500">Gesetz</th>
                      <th className="text-left px-4 py-2 font-medium text-xs text-slate-500">Beschreibung</th>
                      <th className="text-left px-4 py-2 font-medium text-xs text-slate-500">Status</th>
                      <th className="text-right px-4 py-2 font-medium text-xs text-slate-500">Chunks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupLaws.map((law) => {
                      const status = statusMap.get(law.abkuerzung);
                      const chunks = status?.chunks ?? 0;
                      const isIndexed = chunks > 0;
                      const isSelected = selected.has(law.abkuerzung);
                      const isCurrentlyIndexing = indexing && indexingGesetz === law.abkuerzung;

                      return (
                        <tr
                          key={law.abkuerzung}
                          onClick={() => !indexing && toggleSelect(law.abkuerzung)}
                          onKeyDown={(e) => {
                            if (!indexing && (e.key === "Enter" || e.key === " ")) {
                              e.preventDefault();
                              toggleSelect(law.abkuerzung);
                            }
                          }}
                          tabIndex={!indexing ? 0 : undefined}
                          role={!indexing ? "checkbox" : undefined}
                          aria-checked={isSelected}
                          aria-label={`${law.abkuerzung} – ${law.beschreibung}`}
                          className={`border-b border-slate-50 dark:border-slate-700/50 last:border-0 ${
                            !indexing ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30" : ""
                          } ${isCurrentlyIndexing ? "bg-blue-50 dark:bg-blue-900/10" : ""} ${
                            isSelected ? "bg-primary-50 dark:bg-primary-900/10" : ""
                          }`}
                        >
                          {!indexing && (
                            <td className="px-2 py-2 text-center">
                              <span className="text-slate-400" aria-hidden="true">
                                {isSelected ? (
                                  <CheckSquare size={14} className="text-primary-500" />
                                ) : (
                                  <Square size={14} />
                                )}
                              </span>
                            </td>
                          )}
                          <td className="px-4 py-2 font-medium">
                            {isCurrentlyIndexing && (
                              <Loader size={12} className="inline animate-spin mr-1" />
                            )}
                            {law.abkuerzung}
                          </td>
                          <td className="px-4 py-2 text-slate-500 dark:text-slate-400 text-xs truncate max-w-[200px]">
                            {law.beschreibung}
                          </td>
                          <td className="px-4 py-2">
                            {isIndexed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">
                                <CheckCircle size={10} />
                                Indexiert
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 text-xs rounded-full">
                                <XCircle size={10} />
                                Offen
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right text-slate-500 text-xs">
                            {chunks.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* EUTB Section */}
      <div className="mt-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-sm">EUTB-Beratungsstellen</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Daten von teilhabeberatung.de importieren
            </p>
          </div>
          <button
            onClick={indexEutb}
            disabled={eutbLoading}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg"
          >
            {eutbLoading ? (
              <Loader size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Download size={14} aria-hidden="true" />
            )}
            Aktualisieren
          </button>
        </div>
      </div>
    </div>
  );
}
