import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  api,
  type IndexStatusItem,
  type IndexProgressEvent,
  type LawInfo,
} from "../lib/api";
import { ProgressBar } from "../components/ProgressBar";
import { IndexDashboard } from "../components/IndexDashboard";
import { SnapshotSection } from "../components/SnapshotSection";
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
  AlertTriangle,
  ArrowDown,
  Play,
  CloudDownload,
  FileCode,
  Cpu,
  Zap,
  Ban,
  Clock,
} from "lucide-react";

type LogType = "start" | "download" | "parse" | "embedding" | "done" | "error" | "cancel" | "system";

interface LogEntry {
  time: string;
  gesetz: string;
  schritt: string;
  nachricht: string;
  type: LogType;
}

/* ── Visual config per log type ─────────────────────────────────────────── */
const LOG_STYLE: Record<LogType, {
  icon: React.ElementType;
  badge: string;
  badgeCss: string;
  rowCss: string;
  timeCss: string;
  gesetzCss: string;
  msgCss: string;
  label: string;
}> = {
  start: {
    icon: Play,
    badge: "START",
    badgeCss: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800",
    rowCss: "bg-indigo-50/50 dark:bg-indigo-950/20 border-l-4 border-l-indigo-400",
    timeCss: "text-indigo-400 dark:text-indigo-500",
    gesetzCss: "text-indigo-700 dark:text-indigo-300 font-bold",
    msgCss: "text-indigo-600 dark:text-indigo-400 font-medium",
    label: "START",
  },
  download: {
    icon: CloudDownload,
    badge: "DOWNLOAD",
    badgeCss: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800",
    rowCss: "border-l-4 border-l-sky-400",
    timeCss: "text-slate-400",
    gesetzCss: "text-sky-700 dark:text-sky-300 font-semibold",
    msgCss: "text-sky-600 dark:text-sky-400 italic",
    label: "DOWNLOAD",
  },
  parse: {
    icon: FileCode,
    badge: "PARSE",
    badgeCss: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border border-violet-200 dark:border-violet-800",
    rowCss: "border-l-4 border-l-violet-400",
    timeCss: "text-slate-400",
    gesetzCss: "text-violet-700 dark:text-violet-300 font-semibold",
    msgCss: "text-violet-600 dark:text-violet-400 italic",
    label: "PARSE",
  },
  embedding: {
    icon: Cpu,
    badge: "EMBED",
    badgeCss: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
    rowCss: "border-l-4 border-l-amber-400",
    timeCss: "text-slate-400",
    gesetzCss: "text-amber-700 dark:text-amber-300 font-semibold",
    msgCss: "text-amber-600 dark:text-amber-400",
    label: "EMBED",
  },
  done: {
    icon: CheckCircle,
    badge: "DONE",
    badgeCss: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
    rowCss: "bg-emerald-50/50 dark:bg-emerald-950/20 border-l-4 border-l-emerald-500",
    timeCss: "text-emerald-500 dark:text-emerald-600",
    gesetzCss: "text-emerald-700 dark:text-emerald-300 font-bold",
    msgCss: "text-emerald-600 dark:text-emerald-400 font-bold",
    label: "DONE",
  },
  error: {
    icon: AlertTriangle,
    badge: "ERROR",
    badgeCss: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800",
    rowCss: "bg-red-50/50 dark:bg-red-950/20 border-l-4 border-l-red-500",
    timeCss: "text-red-400 dark:text-red-500",
    gesetzCss: "text-red-700 dark:text-red-300 font-bold",
    msgCss: "text-red-600 dark:text-red-400 font-semibold italic",
    label: "ERROR",
  },
  cancel: {
    icon: Ban,
    badge: "CANCEL",
    badgeCss: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800",
    rowCss: "bg-orange-50/50 dark:bg-orange-950/20 border-l-4 border-l-orange-500",
    timeCss: "text-orange-400 dark:text-orange-500",
    gesetzCss: "text-orange-700 dark:text-orange-300 font-bold",
    msgCss: "text-orange-600 dark:text-orange-400 font-semibold italic",
    label: "CANCEL",
  },
  system: {
    icon: Zap,
    badge: "SYSTEM",
    badgeCss: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600",
    rowCss: "bg-slate-50/50 dark:bg-slate-800/50 border-l-4 border-l-slate-400",
    timeCss: "text-slate-400",
    gesetzCss: "text-slate-600 dark:text-slate-300 font-semibold",
    msgCss: "text-slate-500 dark:text-slate-400",
    label: "SYSTEM",
  },
};

function resolveLogType(entry: LogEntry): LogType {
  if (entry.schritt === "start" && entry.gesetz === "System") return "system";
  if (entry.schritt === "start") return "start";
  if (entry.schritt === "download") return "download";
  if (entry.schritt === "parse") return "parse";
  if (entry.schritt === "embedding") return "embedding";
  if (entry.schritt === "done" && entry.gesetz === "System") return "system";
  if (entry.schritt === "done") return "done";
  if (entry.schritt === "error") return "error";
  if (entry.schritt === "cancel") return "cancel";
  return "system";
}

export function IndexPage() {
  const [statusItems, setStatusItems] = useState<IndexStatusItem[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [dbStatus, setDbStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [indexing, setIndexing] = useState(false);
  const [indexingGesetz, setIndexingGesetz] = useState<string | null>(null);
  const [eutbLoading, setEutbLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [laws, setLaws] = useState<LawInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [queue, setQueue] = useState<string[]>([]);
  const [queuePos, setQueuePos] = useState(0);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [embeddingProgress, setEmbeddingProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [completedInSession, setCompletedInSession] = useState<Set<string>>(
    new Set()
  );
  const [failedInSession, setFailedInSession] = useState<Set<string>>(
    new Set()
  );
  const [indexingSummary, setIndexingSummary] = useState("");
  const [autoSnapshotInProgress, setAutoSnapshotInProgress] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll log
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logEntries, autoScroll]);

  // Detect manual scroll
  const handleLogScroll = () => {
    if (!logContainerRef.current) return;
    const el = logContainerRef.current;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  };

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

  const addLog = useCallback(
    (
      gesetz: string,
      schritt: string,
      nachricht: string,
      _type?: string, // kept for call-site compat, type is derived from schritt
    ) => {
      const ts = new Date().toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const entry: LogEntry = { time: ts, gesetz, schritt, nachricht, type: schritt as LogType };
      setLogEntries((prev) => [...prev, entry]);
    },
    []
  );

  // Live-update status table when a law finishes indexing
  const markLawDone = useCallback((gesetz: string, chunks: number) => {
    setStatusItems((prev) => {
      const existing = prev.find((s) => s.gesetz === gesetz);
      const oldChunks = existing?.chunks ?? 0;
      // Update totalChunks by the difference
      setTotalChunks((tc) => tc - oldChunks + chunks);

      if (existing) {
        return prev.map((s) =>
          s.gesetz === gesetz
            ? { ...s, chunks, status: "indexiert" }
            : s
        );
      }
      return [...prev, { gesetz, chunks, status: "indexiert" }];
    });
    setCompletedInSession((prev) => new Set(prev).add(gesetz));
  }, []);

  const markLawFailed = useCallback((gesetz: string) => {
    setFailedInSession((prev) => new Set(prev).add(gesetz));
  }, []);

  // Parse chunk count from "done" message like "150 Chunks indexiert"
  const parseChunkCount = (nachricht: string): number => {
    const match = nachricht.match(/(\d+)\s*Chunks?\s*indexiert/i);
    return match ? parseInt(match[1], 10) : 0;
  };

  const indexNext = useCallback(
    (q: string[], pos: number) => {
      if (pos >= q.length) {
        setIndexing(false);
        setIndexingGesetz(null);
        setQueue([]);
        setQueuePos(0);
        setEmbeddingProgress(null);
        setIndexingSummary("Indexierung abgeschlossen");
        addLog(
          "System",
          "done",
          `Indexierung abgeschlossen – ${q.length} Gesetze verarbeitet`,
          "success"
        );
        // Refresh to get accurate server-side counts
        loadStatus();
        // Auto-extract cross-references after indexing
        addLog("System", "system", "Querverweise werden extrahiert...", "info");
        api.extractReferences({ gesetz: null, full_reindex: false })
          .then((res) => {
            addLog(
              "System",
              "done",
              `Querverweis-Extraktion abgeschlossen: ${res.points_with_refs} Paragraphen mit ${res.total_refs} Verweisen`,
              "info"
            );
          })
          .catch((err: Error) => {
            addLog(
              "System",
              "error",
              `Querverweis-Extraktion fehlgeschlagen: ${err.message}`,
              "error"
            );
          });
        return;
      }

      const name = q[pos];
      setIndexingGesetz(name);
      setEmbeddingProgress(null);
      addLog(
        name,
        "start",
        `Starte Indexierung (${pos + 1}/${q.length})`,
        "info"
      );

      let gotTerminalEvent = false;

      const { cancel } = api.indexGesetze(
        { gesetzbuch: name },
        (event) => {
          if (event.schritt === "download") {
            addLog(name, "download", "Lade herunter...", "info");
          }
          if (event.schritt === "parse") {
            addLog(name, "parse", event.nachricht, "info");
          }
          if (event.schritt === "embedding") {
            // Parse "42/150 Chunks eingebettet..." for progress
            const match = event.nachricht.match(/(\d+)\/(\d+)/);
            if (match) {
              const cur = parseInt(match[1], 10);
              const tot = parseInt(match[2], 10);
              setEmbeddingProgress({ current: cur, total: tot });
              setIndexingSummary(`Indexierung: ${cur} von ${tot}`);
            }
            // Only log every ~25% to avoid log spam
            if (match) {
              const cur = parseInt(match[1], 10);
              const tot = parseInt(match[2], 10);
              if (
                cur === tot ||
                cur === 1 ||
                cur % Math.max(1, Math.floor(tot / 4)) === 0
              ) {
                addLog(name, "embedding", event.nachricht, "progress");
              }
            }
          }
          if (event.schritt === "error") {
            gotTerminalEvent = true;
            addLog(name, "error", event.nachricht, "error");
            markLawFailed(name);
            setIndexingSummary(`Indexierung fehlgeschlagen: ${name}`);
            setError((prev) => {
              const msg = `${name}: ${event.nachricht}`;
              return prev ? `${prev}\n${msg}` : msg;
            });
          }
          if (event.schritt === "done") {
            gotTerminalEvent = true;
            const chunks = parseChunkCount(event.nachricht);
            addLog(name, "done", event.nachricht, "success");
            if (chunks > 0) {
              markLawDone(name, chunks);
            }
          }
        },
        // onStreamEnd
        (_lastEvent) => {
          if (!gotTerminalEvent) {
            addLog(
              name,
              "error",
              "Stream unerwartet beendet (kein done/error Event)",
              "error"
            );
            markLawFailed(name);
          }
          setQueuePos(pos + 1);
          indexNext(q, pos + 1);
        }
      );
      cancelRef.current = cancel;
    },
    [addLog, markLawDone, markLawFailed]
  );

  const startSelectedIndex = async () => {
    if (selected.size === 0) return;
    const q = Array.from(selected);

    // Auto-snapshot before indexing if enabled
    if (localStorage.getItem("paragraf-auto-snapshot") === "true") {
      setAutoSnapshotInProgress(true);
      try {
        await api.createSnapshot();
      } catch (e) {
        console.error("Auto-Snapshot fehlgeschlagen:", e);
      } finally {
        setAutoSnapshotInProgress(false);
      }
    }

    setQueue(q);
    setQueuePos(0);
    setIndexing(true);
    setError(null);
    setLogEntries([]);
    setCompletedInSession(new Set());
    setFailedInSession(new Set());
    setSelected(new Set());
    setIndexingSummary("");
    addLog(
      "System",
      "start",
      `Starte Indexierung von ${q.length} Gesetzen: ${q.join(", ")}`,
      "info"
    );
    indexNext(q, 0);
  };

  const cancelIndex = () => {
    cancelRef.current?.();
    setIndexing(false);
    setIndexingGesetz(null);
    setQueue([]);
    setQueuePos(0);
    setEmbeddingProgress(null);
    addLog("System", "cancel", "Indexierung abgebrochen", "error");
    loadStatus();
  };

  const indexEutb = async () => {
    setEutbLoading(true);
    setError(null);
    addLog("EUTB", "start", "Importiere EUTB-Beratungsstellen...", "info");
    try {
      const res = await api.indexEutb();
      if (res.erfolg) {
        addLog(
          "EUTB",
          "done",
          `${res.total_chunks} Beratungsstellen importiert`,
          "success"
        );
      } else {
        addLog("EUTB", "error", res.fehler.join(", "), "error");
        setError(res.fehler.join(", "));
      }
    } catch (e: any) {
      addLog("EUTB", "error", e.message, "error");
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

  const statusMap = new Map(statusItems.map((s) => [s.gesetz, s]));

  // Group laws by rechtsgebiet
  const groupedLaws = laws.reduce<Record<string, LawInfo[]>>((acc, law) => {
    const group = law.rechtsgebiet || "Sonstiges";
    if (!acc[group]) acc[group] = [];
    acc[group].push(law);
    return acc;
  }, {});

  // Count completed/failed/remaining in queue
  const queueDone = completedInSession.size;
  const queueFailed = failedInSession.size;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
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
            <RefreshCw
              size={14}
              className={loading ? "animate-spin" : ""}
              aria-hidden="true"
            />
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
              disabled={autoSnapshotInProgress}
              className="flex items-center gap-1 px-4 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              <Download size={14} aria-hidden="true" />
              {autoSnapshotInProgress
                ? "Auto-Snapshot wird erstellt..."
                : `${selected.size} ausgewaehlte indexieren`}
            </button>
          )}
          {selected.size > 0 && (
            <span className="text-xs text-slate-400">
              {selected.size} ausgewaehlt
            </span>
          )}
        </div>
      )}

      {/* Dashboard – always visible when not loading, shows live data during indexing */}
      {!loading && (
        <IndexDashboard
          laws={laws}
          statusItems={statusItems}
          totalChunks={totalChunks}
          queue={queue}
          queuePos={queuePos}
          indexingGesetz={indexingGesetz}
          completedInSession={completedInSession}
          failedInSession={failedInSession}
          embeddingProgress={embeddingProgress}
        />
      )}

      {/* Compact progress bars + cancel during indexing */}
      {indexing && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
              <Loader size={12} className="animate-spin" />
              {indexingGesetz} ({queuePos + 1}/{queue.length})
            </p>
            <button
              onClick={cancelIndex}
              className="text-xs px-2 py-0.5 text-red-500 border border-red-300 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Abbrechen
            </button>
          </div>
          <ProgressBar
            progress={queuePos}
            total={queue.length}
            label={`Queue: ${queuePos}/${queue.length}`}
          />
          {embeddingProgress && (
            <ProgressBar
              progress={embeddingProgress.current}
              total={embeddingProgress.total}
              label={`Chunks: ${embeddingProgress.current}/${embeddingProgress.total}`}
            />
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 whitespace-pre-line flex items-start gap-2"
        >
          <AlertTriangle
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <div className="flex-1">{error}</div>
          <button
            onClick={() => setError(null)}
            aria-label="Fehlermeldung schliessen"
            className="text-red-400 hover:text-red-600 text-xs shrink-0"
          >
            Schliessen
          </button>
        </div>
      )}

      {/* Live Log */}
      {logEntries.length > 0 && (
        <div className="mb-4 bg-slate-900 dark:bg-slate-950 border border-slate-700 rounded-lg overflow-hidden shadow-lg">
          {/* Log header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 dark:bg-slate-900 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              </div>
              <h3 className="text-sm font-semibold text-slate-300 ml-2">
                Live-Log
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {logEntries.length} Eintraege
                </span>
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {!autoScroll && (
                <button
                  onClick={() => {
                    setAutoScroll(true);
                    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded bg-slate-700/50"
                >
                  <ArrowDown size={11} /> Auto-Scroll
                </button>
              )}
              {!indexing && (
                <button
                  onClick={() => setLogEntries([])}
                  className="text-xs text-slate-500 hover:text-slate-300 px-2 py-0.5 rounded bg-slate-700/50"
                >
                  Leeren
                </button>
              )}
            </div>
          </div>
          {/* Log body */}
          <div
            ref={logContainerRef}
            onScroll={handleLogScroll}
            className="p-2 max-h-80 overflow-auto font-mono text-[11px] leading-relaxed space-y-0.5"
            role="log"
            aria-live="polite"
            aria-label="Indexierungs-Protokoll"
          >
            {logEntries.map((entry, i) => {
              const logType = resolveLogType(entry);
              const style = LOG_STYLE[logType];
              const Icon = style.icon;

              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded ${style.rowCss}`}
                >
                  {/* Timestamp */}
                  <span className={`shrink-0 tabular-nums ${style.timeCss}`}>
                    {entry.time}
                  </span>

                  {/* Badge with icon */}
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${style.badgeCss}`}
                  >
                    <Icon size={10} />
                    {style.label}
                  </span>

                  {/* Gesetz name */}
                  <span
                    className={`shrink-0 w-24 truncate ${style.gesetzCss}`}
                  >
                    {entry.gesetz}
                  </span>

                  {/* Separator */}
                  <span className="text-slate-600 shrink-0" aria-hidden="true">|</span>

                  {/* Message */}
                  <span className={`truncate ${style.msgCss}`}>
                    {entry.nachricht}
                  </span>
                </div>
              );
            })}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {/* Table grouped by Rechtsgebiet */}
      {loading ? (
        <div
          className="flex justify-center py-12"
          role="status"
          aria-live="polite"
        >
          <Loader
            className="animate-spin text-primary-500"
            size={24}
            aria-hidden="true"
          />
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
                  aria-checked={
                    allGroupSelected
                      ? true
                      : someGroupSelected
                      ? "mixed"
                      : false
                  }
                  aria-label={`${group} – alle ${groupLaws.length} Gesetze auswaehlen`}
                  tabIndex={!indexing ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (
                      !indexing &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
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
                      {!indexing && (
                        <th className="w-8 px-2 py-2">
                          <span className="sr-only">Auswahl</span>
                        </th>
                      )}
                      <th className="text-left px-4 py-2 font-medium text-xs text-slate-500">
                        Gesetz
                      </th>
                      <th className="text-left px-4 py-2 font-medium text-xs text-slate-500">
                        Beschreibung
                      </th>
                      <th className="text-left px-4 py-2 font-medium text-xs text-slate-500">
                        Status
                      </th>
                      <th className="text-right px-4 py-2 font-medium text-xs text-slate-500">
                        Chunks
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupLaws.map((law) => {
                      const status = statusMap.get(law.abkuerzung);
                      const chunks = status?.chunks ?? 0;
                      const isIndexed = chunks > 0;
                      const isSelected = selected.has(law.abkuerzung);
                      const isCurrentlyIndexing =
                        indexing && indexingGesetz === law.abkuerzung;
                      const isInQueue =
                        indexing && queue.includes(law.abkuerzung);
                      const justCompleted = completedInSession.has(
                        law.abkuerzung
                      );
                      const justFailed = failedInSession.has(law.abkuerzung);

                      return (
                        <tr
                          key={law.abkuerzung}
                          onClick={() =>
                            !indexing && toggleSelect(law.abkuerzung)
                          }
                          onKeyDown={(e) => {
                            if (
                              !indexing &&
                              (e.key === "Enter" || e.key === " ")
                            ) {
                              e.preventDefault();
                              toggleSelect(law.abkuerzung);
                            }
                          }}
                          tabIndex={!indexing ? 0 : undefined}
                          role={!indexing ? "checkbox" : undefined}
                          aria-checked={isSelected}
                          aria-label={`${law.abkuerzung} – ${law.beschreibung}`}
                          className={`border-b border-slate-50 dark:border-slate-700/50 last:border-0 transition-colors duration-500 ${
                            !indexing
                              ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30"
                              : ""
                          } ${
                            isCurrentlyIndexing
                              ? "bg-blue-50 dark:bg-blue-900/20"
                              : justCompleted
                              ? "bg-green-50 dark:bg-green-900/10"
                              : justFailed
                              ? "bg-red-50 dark:bg-red-900/10"
                              : isSelected
                              ? "bg-primary-50 dark:bg-primary-900/10"
                              : ""
                          }`}
                        >
                          {!indexing && (
                            <td className="px-2 py-2 text-center">
                              <span
                                className="text-slate-400"
                                aria-hidden="true"
                              >
                                {isSelected ? (
                                  <CheckSquare
                                    size={14}
                                    className="text-primary-500"
                                  />
                                ) : (
                                  <Square size={14} />
                                )}
                              </span>
                            </td>
                          )}
                          <td className="px-4 py-2 font-medium whitespace-nowrap">
                            {isCurrentlyIndexing && (
                              <Loader
                                size={12}
                                className="inline animate-spin mr-1.5 text-blue-500"
                              />
                            )}
                            {justCompleted && !isCurrentlyIndexing && (
                              <CheckCircle
                                size={12}
                                className="inline mr-1.5 text-green-500"
                              />
                            )}
                            {justFailed && !isCurrentlyIndexing && (
                              <XCircle
                                size={12}
                                className="inline mr-1.5 text-red-500"
                              />
                            )}
                            {law.abkuerzung}
                            {isInQueue &&
                              !isCurrentlyIndexing &&
                              !justCompleted &&
                              !justFailed && (
                                <span className="ml-1.5 text-xs text-slate-400">
                                  (wartet)
                                </span>
                              )}
                          </td>
                          <td className="px-4 py-2 text-slate-500 dark:text-slate-400 text-xs truncate max-w-[200px]">
                            {law.beschreibung}
                          </td>
                          <td className="px-4 py-2">
                            {isCurrentlyIndexing ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full">
                                <Loader size={10} className="animate-spin" />
                                Wird indexiert...
                              </span>
                            ) : isIndexed ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
                                  justCompleted
                                    ? "bg-green-200 dark:bg-green-800/40 text-green-800 dark:text-green-300 font-medium"
                                    : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                }`}
                              >
                                <CheckCircle size={10} />
                                {justCompleted ? "Fertig!" : "Indexiert"}
                              </span>
                            ) : justFailed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs rounded-full">
                                <XCircle size={10} />
                                Fehler
                              </span>
                            ) : isInQueue && !justCompleted && !justFailed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded-full">
                                <Clock size={10} />
                                Warte auf Indexierung
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 text-xs rounded-full">
                                <XCircle size={10} />
                                Offen
                              </span>
                            )}
                          </td>
                          <td
                            className={`px-4 py-2 text-right text-xs ${
                              justCompleted
                                ? "text-green-600 dark:text-green-400 font-semibold"
                                : "text-slate-500"
                            }`}
                          >
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

      {/* Snapshot Management */}
      {!loading && <SnapshotSection />}

      {/* Indexing progress sr-only announcement */}
      <div aria-live="polite" className="sr-only" role="status">
        {indexingSummary}
      </div>

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
              <Loader
                size={14}
                className="animate-spin"
                aria-hidden="true"
              />
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
