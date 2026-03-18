import React, { useState, useEffect, useContext } from "react";
import { useBackend } from "../hooks/useBackend";
import { api, type HealthResponse } from "../lib/api";
import { ThemeContext } from "../App";
import {
  Settings,
  Play,
  Square,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  Keyboard,
} from "lucide-react";

export function SettingsPage() {
  const backend = useBackend();
  const { dark, toggle } = useContext(ThemeContext);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    if (backend.isReady) {
      api.health().then(setHealth).catch(() => {});
    }
  }, [backend.isReady]);

  const StatusDot = ({ ok }: { ok: boolean }) => (
    <div
      className={`w-3 h-3 rounded-full ${
        ok ? "bg-green-500" : "bg-red-500"
      }`}
    />
  );

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Settings size={24} />
        Einstellungen
      </h1>

      {/* Server Status */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5 mb-4">
        <h2 className="font-semibold mb-4">Server-Status</h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusDot ok={backend.status.qdrant} />
              <span className="text-sm">Qdrant</span>
            </div>
            <span className="text-xs text-slate-500">
              {health?.qdrant_status || (backend.status.qdrant ? "Läuft" : "Gestoppt")}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusDot ok={backend.status.backend} />
              <span className="text-sm">Python Backend</span>
            </div>
            <span className="text-xs text-slate-500">
              {backend.isLoading
                ? `${backend.status.loadingStage} (${backend.status.loadingProgress}%)`
                : backend.status.backend ? "Bereit" : "Gestoppt"}
            </span>
          </div>

          {health && (
            <>
              <hr className="border-slate-200 dark:border-slate-700" />
              <div className="text-xs text-slate-500 space-y-1">
                <p>Embedding: {health.embedding_model} ({health.embedding_dimension}d, {health.embedding_device})</p>
                <p>Collection: {health.qdrant_collection}</p>
                <p>Indexierte Chunks: {health.indexierte_chunks.toLocaleString()}</p>
              </div>
            </>
          )}
        </div>

        {/* Start/Stop buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={backend.start}
            disabled={backend.isReady || backend.starting}
            className="flex items-center gap-1 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg"
          >
            <Play size={14} />
            {backend.starting ? "Startet..." : "Starten"}
          </button>
          <button
            onClick={backend.stop}
            disabled={backend.status.state === "stopped" || backend.stopping}
            className="flex items-center gap-1 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg"
          >
            <Square size={14} />
            {backend.stopping ? "Stoppt..." : "Stoppen"}
          </button>
        </div>

        {backend.status.error && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300">
            {backend.status.error}
          </div>
        )}
      </section>

      {/* Appearance */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5 mb-4">
        <h2 className="font-semibold mb-4">Darstellung</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {dark ? <Moon size={18} /> : <Sun size={18} />}
            <span className="text-sm">Dark Mode</span>
          </div>
          <button
            onClick={toggle}
            className={`w-12 h-6 rounded-full transition-colors relative ${
              dark ? "bg-primary-600" : "bg-slate-300"
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                dark ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5 mb-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Keyboard size={18} />
          Tastenkürzel
        </h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            ["Ctrl+K", "Suche öffnen"],
            ["Ctrl+1", "Suche"],
            ["Ctrl+2", "Nachschlagen"],
            ["Ctrl+3", "Vergleich"],
            ["Ctrl+4", "Gesetze"],
            ["Ctrl+5", "EUTB"],
            ["Ctrl+6", "Index"],
            ["Ctrl+7", "Einstellungen"],
            ["Escape", "Eingabe leeren"],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between py-1">
              <span className="text-slate-500">{desc}</span>
              <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-xs rounded border border-slate-200 dark:border-slate-600">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </section>

      {/* Log Viewer */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowLog(!showLog)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          <h2 className="font-semibold text-sm">Server-Log</h2>
          {showLog ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showLog && (
          <div className="border-t border-slate-200 dark:border-slate-700 p-4 max-h-64 overflow-auto">
            <pre className="text-xs text-slate-500 dark:text-slate-400 font-mono whitespace-pre-wrap">
              {backend.status.log.length > 0
                ? backend.status.log.join("\n")
                : "Keine Log-Einträge"}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}
