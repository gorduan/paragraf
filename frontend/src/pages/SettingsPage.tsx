import React, { useState, useEffect, useContext, useCallback } from "react";
import {
  api,
  type HealthResponse,
  type SettingsResponse,
  type GpuInfoResponse,
} from "../lib/api";
import { ThemeContext } from "../App";
import {
  Settings,
  Sun,
  Moon,
  Keyboard,
  Copy,
  Check,
  Server,
} from "lucide-react";

export function SettingsPage() {
  const { dark, toggle } = useContext(ThemeContext);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [gpuInfo, setGpuInfo] = useState<GpuInfoResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Load data from API
  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
    api.settings().then(setSettings).catch(() => {});
    api.gpuInfo().then(setGpuInfo).catch(() => {});
  }, []);

  const handleCopyMcpCommand = useCallback(() => {
    navigator.clipboard.writeText(
      "claude mcp add paragraf --url http://localhost:8000/mcp",
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const StatusDot = ({ ok }: { ok: boolean }) => (
    <div
      className={`w-3 h-3 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`}
      aria-hidden="true"
      title={ok ? "Verbunden" : "Nicht verbunden"}
    />
  );

  const Section = ({
    children,
    className = "mb-4",
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <section
      className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5 ${className}`}
    >
      {children}
    </section>
  );

  const InfoRow = ({ label, value }: { label: string; value: string | number | undefined }) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <span className="text-sm font-mono text-slate-500 dark:text-slate-400">
        {value ?? "–"}
      </span>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Settings size={24} aria-hidden="true" />
        Einstellungen
      </h1>

      {/* Server Status */}
      <Section>
        <h2 className="font-semibold mb-4">Server-Status</h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusDot ok={health?.qdrant_status === "ok"} />
              <span className="text-sm">Qdrant</span>
              <span className="sr-only">({health?.qdrant_status === "ok" ? "verbunden" : "nicht verbunden"})</span>
            </div>
            <span className="text-xs text-slate-500">
              {health?.qdrant_status || "Unbekannt"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusDot ok={health?.status === "ok" || health?.status === "healthy"} />
              <span className="text-sm">Python Backend</span>
              <span className="sr-only">({health ? "verbunden" : "nicht verbunden"})</span>
            </div>
            <span className="text-xs text-slate-500">
              {health ? "Bereit" : "Nicht erreichbar"}
            </span>
          </div>

          {health && (
            <>
              <hr className="border-slate-200 dark:border-slate-700" />
              <div className="text-xs text-slate-500 space-y-1">
                <p>
                  Embedding: {health.embedding_model} (
                  {health.embedding_dimension}d, {health.embedding_device})
                </p>
                <p>Collection: {health.qdrant_collection}</p>
                <p>
                  Indexierte Chunks:{" "}
                  {health.indexierte_chunks.toLocaleString()}
                </p>
              </div>
            </>
          )}
        </div>
      </Section>

      {/* Aktuelle Konfiguration (Read-only) */}
      <Section>
        <h2 className="font-semibold mb-4">Konfiguration</h2>
        <p className="text-xs text-slate-400 mb-3">
          Einstellungen werden ueber Environment-Variablen in <code>docker-compose.yml</code> gesteuert.
        </p>
        {settings ? (
          <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-700">
            <InfoRow label="Geraet" value={settings.embedding_device} />
            <InfoRow label="Batch-Groesse" value={settings.embedding_batch_size} />
            <InfoRow label="Max Token" value={settings.embedding_max_length} />
            <InfoRow label="Ergebnisse (Reranking)" value={settings.reranker_top_k} />
            <InfoRow label="Kandidaten (Retrieval)" value={settings.retrieval_top_k} />
            <InfoRow label="Relevanz-Schwelle" value={settings.similarity_threshold} />
            <InfoRow label="Qdrant URL" value={settings.qdrant_url} />
            <InfoRow label="HF Home" value={settings.hf_home} />
            <InfoRow label="Torch Home" value={settings.torch_home} />
          </div>
        ) : (
          <p className="text-sm text-slate-400">Backend nicht erreichbar</p>
        )}

        {gpuInfo && (
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-medium mb-2">GPU</h3>
            <div className="text-xs text-slate-500 space-y-1">
              <p>CUDA verfuegbar: {gpuInfo.cuda_available ? "Ja" : "Nein"}</p>
              {gpuInfo.cuda_available && (
                <>
                  <p>GPU: {gpuInfo.gpu_name}</p>
                  <p>VRAM: {gpuInfo.vram_total_mb} MB</p>
                </>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* MCP-Server */}
      <Section>
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Server size={18} aria-hidden="true" />
          MCP-Server (fuer Claude Desktop/Code)
        </h2>

        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Der MCP-Server laeuft im Backend-Container auf Port 8000.
          </p>

          <div className="mt-3">
            <p className="text-xs text-slate-500 mb-1">
              Claude Code Befehl:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 text-xs font-mono bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded select-all">
                claude mcp add paragraf --url http://localhost:8000/mcp
              </code>
              <button
                onClick={handleCopyMcpCommand}
                className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                aria-label={copied ? "Befehl kopiert" : "MCP-Befehl kopieren"}
              >
                {copied ? (
                  <Check size={16} className="text-green-500" aria-hidden="true" />
                ) : (
                  <Copy size={16} aria-hidden="true" />
                )}
                <span className="sr-only" aria-live="polite">{copied ? "Kopiert" : ""}</span>
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* Darstellung */}
      <Section>
        <h2 className="font-semibold mb-4">Darstellung</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {dark ? <Moon size={18} /> : <Sun size={18} />}
            <span className="text-sm">Dark Mode</span>
          </div>
          <button
            onClick={toggle}
            role="switch"
            aria-checked={dark}
            aria-label="Dark Mode umschalten"
            className={`w-12 h-6 rounded-full transition-colors relative ${
              dark ? "bg-primary-600" : "bg-slate-300"
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                dark ? "translate-x-6" : "translate-x-0.5"
              }`}
              aria-hidden="true"
            />
          </button>
        </div>
      </Section>

      {/* Keyboard Shortcuts */}
      <Section>
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Keyboard size={18} aria-hidden="true" />
          Tastenkuerzel
        </h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            ["Ctrl+1", "Suche"],
            ["Ctrl+2", "Nachschlagen"],
            ["Ctrl+3", "Vergleich"],
            ["Ctrl+4", "Gesetze"],
            ["Ctrl+5", "EUTB"],
            ["Ctrl+6", "Index"],
            ["Ctrl+7", "Einstellungen"],
            ["Escape", "Eingabe leeren"],
          ].map(([key, desc]) => (
            <div
              key={key}
              className="flex items-center justify-between py-1"
            >
              <span className="text-slate-500">{desc}</span>
              <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-xs rounded border border-slate-200 dark:border-slate-600">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
