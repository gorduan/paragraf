import React, { useState, useEffect, useContext, useCallback } from "react";
import { useBackend } from "../hooks/useBackend";
import {
  api,
  type HealthResponse,
  type SettingsResponse,
  type GpuInfoResponse,
} from "../lib/api";
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
  Copy,
  Check,
  Loader2,
  Server,
} from "lucide-react";

interface FormValues {
  embedding_device: string;
  embedding_batch_size: number;
  embedding_max_length: number;
  reranker_top_k: number;
  retrieval_top_k: number;
  similarity_threshold: number;
  qdrant_url: string;
  hf_home: string;
  torch_home: string;
}

const DEFAULT_FORM: FormValues = {
  embedding_device: "cpu",
  embedding_batch_size: 8,
  embedding_max_length: 512,
  reranker_top_k: 5,
  retrieval_top_k: 20,
  similarity_threshold: 0.35,
  qdrant_url: "http://localhost:6333",
  hf_home: "",
  torch_home: "",
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + units[i];
}

export function SettingsPage() {
  const backend = useBackend();
  const { dark, toggle } = useContext(ThemeContext);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [gpuInfo, setGpuInfo] = useState<GpuInfoResponse | null>(null);
  const [showLog, setShowLog] = useState(false);

  // Settings form
  const [form, setForm] = useState<FormValues>(DEFAULT_FORM);
  const [original, setOriginal] = useState<FormValues>(DEFAULT_FORM);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Disk usage
  const [hfSize, setHfSize] = useState<string>("");
  const [torchSize, setTorchSize] = useState<string>("");

  // MCP
  const [mcpStarting, setMcpStarting] = useState(false);
  const [mcpStopping, setMcpStopping] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load settings from .env via IPC (always available, even without backend)
  useEffect(() => {
    window.electronAPI?.settings.load().then((env) => {
      const vals: FormValues = {
        embedding_device: env.EMBEDDING_DEVICE || DEFAULT_FORM.embedding_device,
        embedding_batch_size: Number(env.EMBEDDING_BATCH_SIZE) || DEFAULT_FORM.embedding_batch_size,
        embedding_max_length: Number(env.EMBEDDING_MAX_LENGTH) || DEFAULT_FORM.embedding_max_length,
        reranker_top_k: Number(env.RERANKER_TOP_K) || DEFAULT_FORM.reranker_top_k,
        retrieval_top_k: Number(env.RETRIEVAL_TOP_K) || DEFAULT_FORM.retrieval_top_k,
        similarity_threshold: Number(env.SIMILARITY_THRESHOLD) || DEFAULT_FORM.similarity_threshold,
        qdrant_url: env.QDRANT_URL || DEFAULT_FORM.qdrant_url,
        hf_home: env.HF_HOME || "",
        torch_home: env.TORCH_HOME || "",
      };
      setForm(vals);
      setOriginal(vals);
    }).catch(() => {});
  }, []);

  // Load health + GPU info when backend is ready
  useEffect(() => {
    if (backend.isReady) {
      api.health().then(setHealth).catch(() => {});
      api.gpuInfo().then(setGpuInfo).catch(() => {});
    }
  }, [backend.isReady]);

  // Load disk usage
  useEffect(() => {
    if (form.hf_home) {
      window.electronAPI?.settings
        .getDiskUsage(form.hf_home)
        .then((r) => setHfSize(r.exists ? formatBytes(r.sizeBytes) : "nicht vorhanden"))
        .catch(() => {});
    }
    if (form.torch_home) {
      window.electronAPI?.settings
        .getDiskUsage(form.torch_home)
        .then((r) => setTorchSize(r.exists ? formatBytes(r.sizeBytes) : "nicht vorhanden"))
        .catch(() => {});
    }
  }, [form.hf_home, form.torch_home]);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(form) !== JSON.stringify(original);
    setHasChanges(changed);

    // Validation
    if (form.retrieval_top_k < form.reranker_top_k) {
      setValidationError("Kandidaten (Retrieval) muss >= Ergebnisse (Reranking) sein");
    } else if (!form.qdrant_url.startsWith("http")) {
      setValidationError("Qdrant URL muss mit http beginnen");
    } else {
      setValidationError(null);
    }
  }, [form, original]);

  const updateForm = useCallback(
    <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setShowConfirm(false);
    setSaving(true);
    try {
      const envMap: Record<string, string> = {
        EMBEDDING_DEVICE: form.embedding_device,
        EMBEDDING_BATCH_SIZE: String(form.embedding_batch_size),
        EMBEDDING_MAX_LENGTH: String(form.embedding_max_length),
        RERANKER_TOP_K: String(form.reranker_top_k),
        RETRIEVAL_TOP_K: String(form.retrieval_top_k),
        SIMILARITY_THRESHOLD: String(form.similarity_threshold),
        QDRANT_URL: form.qdrant_url,
        HF_HOME: form.hf_home,
        TORCH_HOME: form.torch_home,
      };
      await window.electronAPI?.settings.save(envMap);
      setOriginal(form);
    } finally {
      setSaving(false);
    }
  }, [form]);

  // MCP handlers
  const handleMcpStart = useCallback(async () => {
    setMcpStarting(true);
    try {
      await window.electronAPI?.mcp.start();
    } finally {
      setMcpStarting(false);
    }
  }, []);

  const handleMcpStop = useCallback(async () => {
    setMcpStopping(true);
    try {
      await window.electronAPI?.mcp.stop();
    } finally {
      setMcpStopping(false);
    }
  }, []);

  const handleCopyMcpCommand = useCallback(() => {
    navigator.clipboard.writeText(
      "claude mcp add paragraf --url http://localhost:8001/mcp",
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const StatusDot = ({ ok }: { ok: boolean }) => (
    <div
      className={`w-3 h-3 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`}
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

  const disabled = !backend.isReady;

  const SliderRow = ({
    label,
    value,
    min,
    max,
    step = 1,
    onChange,
    format,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (v: number) => void;
    format?: (v: number) => string;
  }) => (
    <div className={`flex items-center justify-between gap-4 ${disabled ? "opacity-50" : ""}`}>
      <label className="text-sm text-slate-600 dark:text-slate-300 min-w-[160px]">
        {label}
      </label>
      <div className="flex items-center gap-3 flex-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="flex-1 accent-primary-600"
        />
        <span className="text-sm font-mono w-16 text-right">
          {format ? format(value) : value}
        </span>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Settings size={24} />
        Einstellungen
      </h1>

      {/* Server Status */}
      <Section>
        <h2 className="font-semibold mb-4">Server-Status</h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusDot ok={backend.status.qdrant} />
              <span className="text-sm">Qdrant</span>
            </div>
            <span className="text-xs text-slate-500">
              {health?.qdrant_status ||
                (backend.status.qdrant ? "Läuft" : "Gestoppt")}
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
                : backend.status.backend
                  ? "Bereit"
                  : "Gestoppt"}
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
      </Section>

      {/* Leistung */}
      <Section>
        <h2 className="font-semibold mb-4">Leistung</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm text-slate-600 dark:text-slate-300 min-w-[160px]">
              Gerät
            </label>
            <select
              value={form.embedding_device}
              onChange={(e) => updateForm("embedding_device", e.target.value)}
              disabled={!backend.isReady}
              className="flex-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 disabled:opacity-50"
            >
              <option value="cpu">CPU</option>
              {gpuInfo?.cuda_available ? (
                <option value="cuda">
                  GPU ({gpuInfo.gpu_name}, {gpuInfo.vram_total_mb} MB VRAM)
                </option>
              ) : (
                <option value="cuda" disabled>
                  GPU (nicht verfügbar)
                </option>
              )}
            </select>
          </div>

          <SliderRow
            label="Batch-Größe"
            value={form.embedding_batch_size}
            min={1}
            max={64}
            onChange={(v) => updateForm("embedding_batch_size", v)}
          />

          <SliderRow
            label="Max Token"
            value={form.embedding_max_length}
            min={128}
            max={1024}
            step={64}
            onChange={(v) => updateForm("embedding_max_length", v)}
          />
        </div>
      </Section>

      {/* Suchqualitaet */}
      <Section>
        <h2 className="font-semibold mb-4">Suchqualität</h2>
        <div className="space-y-4">
          <SliderRow
            label="Ergebnisse (Reranking)"
            value={form.reranker_top_k}
            min={1}
            max={20}
            onChange={(v) => updateForm("reranker_top_k", v)}
          />

          <SliderRow
            label="Kandidaten (Retrieval)"
            value={form.retrieval_top_k}
            min={5}
            max={100}
            onChange={(v) => updateForm("retrieval_top_k", v)}
          />

          <SliderRow
            label="Relevanz-Schwelle"
            value={form.similarity_threshold}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) =>
              updateForm("similarity_threshold", Math.round(v * 100) / 100)
            }
            format={(v) => v.toFixed(2)}
          />
        </div>
      </Section>

      {/* Verbindung */}
      <Section>
        <h2 className="font-semibold mb-4">Verbindung</h2>
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm text-slate-600 dark:text-slate-300 min-w-[160px]">
            Qdrant URL
          </label>
          <input
            type="text"
            value={form.qdrant_url}
            onChange={(e) => updateForm("qdrant_url", e.target.value)}
            disabled={disabled}
            className="flex-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 font-mono disabled:opacity-50"
          />
        </div>
      </Section>

      {/* Cache-Verzeichnisse */}
      <Section>
        <h2 className="font-semibold mb-4">Cache-Verzeichnisse</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm text-slate-600 dark:text-slate-300 min-w-[120px]">
              HuggingFace
            </label>
            <input
              type="text"
              value={form.hf_home}
              onChange={(e) => updateForm("hf_home", e.target.value)}
              disabled={!backend.isReady}
              className="flex-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 font-mono disabled:opacity-50"
            />
            <span className="text-xs text-slate-500 min-w-[80px] text-right">
              {hfSize}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm text-slate-600 dark:text-slate-300 min-w-[120px]">
              PyTorch
            </label>
            <input
              type="text"
              value={form.torch_home}
              onChange={(e) => updateForm("torch_home", e.target.value)}
              disabled={!backend.isReady}
              className="flex-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 font-mono disabled:opacity-50"
            />
            <span className="text-xs text-slate-500 min-w-[80px] text-right">
              {torchSize}
            </span>
          </div>
        </div>
      </Section>

      {/* MCP-Server */}
      <Section>
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Server size={18} />
          MCP-Server (für Claude Desktop/Code)
        </h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusDot ok={backend.status.mcp} />
              <span className="text-sm">
                {backend.status.mcp
                  ? "Läuft auf Port 8001"
                  : "Gestoppt"}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              Transport: streamable-http
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleMcpStart}
              disabled={backend.status.mcp || mcpStarting || !backend.isReady}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg"
            >
              {mcpStarting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={14} />
              )}
              {mcpStarting ? "Startet..." : "Starten"}
            </button>
            <button
              onClick={handleMcpStop}
              disabled={!backend.status.mcp || mcpStopping}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg"
            >
              <Square size={14} />
              {mcpStopping ? "Stoppt..." : "Stoppen"}
            </button>
          </div>

          <div className="mt-3">
            <p className="text-xs text-slate-500 mb-1">
              Claude Code Befehl:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 text-xs font-mono bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded select-all">
                claude mcp add paragraf --url http://localhost:8001/mcp
              </code>
              <button
                onClick={handleCopyMcpCommand}
                className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                title="Kopieren"
              >
                {copied ? (
                  <Check size={16} className="text-green-500" />
                ) : (
                  <Copy size={16} />
                )}
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
      </Section>

      {/* Speichern & Neustart */}
      <Section>
        {validationError && (
          <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-700 dark:text-yellow-300">
            {validationError}
          </div>
        )}

        <button
          onClick={() => setShowConfirm(true)}
          disabled={!hasChanges || !!validationError || saving || disabled}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-medium"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Neustart läuft...
            </>
          ) : (
            "Speichern & Neustart"
          )}
        </button>

        {!hasChanges && !disabled && (
          <p className="text-xs text-slate-400 text-center mt-2">
            Keine Änderungen
          </p>
        )}

        {/* Confirm Dialog */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 max-w-md mx-4 shadow-xl">
              <h3 className="font-semibold mb-2">Backend neu starten?</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Die Einstellungen werden in <code>.env</code> gespeichert und
                das Backend wird neu gestartet. Dies dauert ca. 30–60 Sekunden
                (Modelle werden neu geladen).
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
                >
                  Neustart
                </button>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Keyboard Shortcuts */}
      <Section>
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
