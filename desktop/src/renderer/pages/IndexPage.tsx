import React, { useState, useEffect } from "react";
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

  const startIndex = (gesetzbuch?: string) => {
    setIndexing(true);
    setIndexingGesetz(gesetzbuch || "Alle");
    setError(null);
    setProgress(null);

    const { cancel } = api.indexGesetze(
      { gesetzbuch: gesetzbuch || null },
      (event) => {
        setProgress(event);
        if (event.schritt === "error") {
          setError(event.nachricht);
        }
        // Refresh status after completion
        if (event.schritt === "done" && (!event.gesamt || event.fortschritt >= event.gesamt)) {
          setIndexing(false);
          setIndexingGesetz(null);
          loadStatus();
        }
      }
    );
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
            <Database size={24} />
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
            disabled={loading}
            className="flex items-center gap-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Aktualisieren
          </button>
          <button
            onClick={() => startIndex()}
            disabled={indexing}
            className="flex items-center gap-1 px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-medium"
          >
            <Download size={14} />
            Alle indexieren
          </button>
        </div>
      </div>

      {/* Progress */}
      {indexing && progress && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm font-medium mb-2">
            Indexierung: {indexingGesetz}
          </p>
          <ProgressBar
            progress={progress.fortschritt}
            total={progress.gesamt}
            label={progress.nachricht}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Table grouped by Rechtsgebiet */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader className="animate-spin text-primary-500" size={24} />
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedLaws).map(([group, groupLaws]) => (
            <div
              key={group}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
            >
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
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
                    <th className="text-left px-4 py-2 font-medium text-xs text-slate-500">Gesetz</th>
                    <th className="text-left px-4 py-2 font-medium text-xs text-slate-500">Beschreibung</th>
                    <th className="text-left px-4 py-2 font-medium text-xs text-slate-500">Status</th>
                    <th className="text-right px-4 py-2 font-medium text-xs text-slate-500">Chunks</th>
                    <th className="text-right px-4 py-2 font-medium text-xs text-slate-500">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {groupLaws.map((law) => {
                    const status = statusMap.get(law.abkuerzung);
                    const chunks = status?.chunks ?? 0;
                    const isIndexed = chunks > 0;
                    return (
                      <tr
                        key={law.abkuerzung}
                        className="border-b border-slate-50 dark:border-slate-700/50 last:border-0"
                      >
                        <td className="px-4 py-2 font-medium">{law.abkuerzung}</td>
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
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => startIndex(law.abkuerzung)}
                            disabled={indexing}
                            className="text-xs text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
                          >
                            {isIndexed ? "Neu" : "Indexieren"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
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
              <Loader size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Aktualisieren
          </button>
        </div>
      </div>
    </div>
  );
}
