import React, { useState, useEffect, useContext, useCallback } from "react";
import {
  api,
  type HealthResponse,
  type SettingsResponse,
  type GpuDetectionResponse,
  type CacheInfoResponse,
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
  Cpu,
  HardDrive,
  Trash2,
} from "lucide-react";

export function SettingsPage() {
  const { dark, toggle } = useContext(ThemeContext);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [gpuInfo, setGpuInfo] = useState<GpuDetectionResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<CacheInfoResponse | null>(null);
  const [gpuSwitching, setGpuSwitching] = useState(false);
  const [gpuEnabled, setGpuEnabled] = useState(false);
  const [gpuSwitchError, setGpuSwitchError] = useState<string | null>(null);
  const [showCacheConfirm, setShowCacheConfirm] = useState(false);
  const [cacheClearing, setCacheClearing] = useState(false);
  const [cacheError, setCacheError] = useState<string | null>(null);
  const isDesktop = !!window.paragrafDesktop?.isDesktop;

  // Load data from API
  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
    api.settings().then(setSettings).catch(() => {});
    api.gpuDetection().then(setGpuInfo).catch(() => {});
    api.cacheInfo().then(setCacheInfo).catch(() => {});
    if (isDesktop) {
      window.paragrafSetup?.getGpuPreference().then((r) => setGpuEnabled(r.gpuEnabled));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopyMcpCommand = useCallback(() => {
    navigator.clipboard.writeText(
      "claude mcp add paragraf --url http://localhost:8000/mcp",
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleGpuToggle = useCallback(async () => {
    const newEnabled = !gpuEnabled;
    setGpuSwitching(true);
    setGpuSwitchError(null);
    try {
      const result = await window.paragrafSetup?.switchGpu(newEnabled);
      if (result?.success) {
        setGpuEnabled(result.gpuEnabled);
      } else {
        setGpuEnabled(false);
        setGpuSwitchError("GPU-Modus konnte nicht aktiviert werden. CPU-Modus wird verwendet.");
      }
    } catch {
      setGpuEnabled(false);
      setGpuSwitchError("GPU-Modus konnte nicht aktiviert werden. CPU-Modus wird verwendet.");
    } finally {
      setGpuSwitching(false);
    }
  }, [gpuEnabled]);

  const handleClearCache = useCallback(async () => {
    setShowCacheConfirm(false);
    setCacheClearing(true);
    setCacheError(null);
    try {
      // D-07: The Electron IPC handler (setup:clearModelCache) also resets
      // setupStep=4 and setupComplete=false, so the download step will
      // re-appear on next app start. No additional reset call needed here.
      if (isDesktop) {
        const result = await window.paragrafSetup?.clearModelCache();
        if (!result?.success) throw new Error(result?.error || "Unbekannter Fehler");
      } else {
        await api.clearCache();
      }
      const info = await api.cacheInfo();
      setCacheInfo(info);
    } catch (e: unknown) {
      setCacheError(e instanceof Error ? e.message : "Cache konnte nicht geloescht werden");
    } finally {
      setCacheClearing(false);
    }
  }, [isDesktop]);

  const handleChangeCachePath = useCallback(async () => {
    const newPath = await window.paragrafSetup?.selectModelCachePath();
    if (newPath) {
      const info = await api.cacheInfo();
      setCacheInfo(info);
    }
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

      </Section>

      {/* GPU-Konfiguration */}
      <Section>
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Cpu size={18} aria-hidden="true" />
          GPU-Konfiguration
        </h2>

        {gpuInfo && (gpuInfo.nvidia_smi_available || gpuInfo.cuda_available) ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm">
                  {gpuEnabled
                    ? `GPU-Modus aktiv (${gpuInfo.gpu_name})`
                    : "CPU-Modus aktiv"}
                </span>
              </div>
              {isDesktop ? (
                <button
                  onClick={handleGpuToggle}
                  role="switch"
                  aria-checked={gpuEnabled}
                  aria-label="GPU-Modus"
                  disabled={gpuSwitching}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    gpuEnabled ? "bg-primary-600" : "bg-slate-300"
                  } ${gpuSwitching ? "opacity-50 cursor-wait" : ""}`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      gpuEnabled ? "translate-x-6" : "translate-x-0.5"
                    }`}
                    aria-hidden="true"
                  />
                </button>
              ) : (
                <span className="text-xs text-slate-500">
                  GPU-Wechsel erfordert Docker-Neustart
                </span>
              )}
            </div>

            {gpuSwitching && (
              <p className="text-sm text-slate-500 animate-pulse" role="status">
                Backend wird neu gestartet...
              </p>
            )}

            {gpuSwitchError && (
              <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-2" role="alert">
                {gpuSwitchError}
              </p>
            )}

            <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-200 dark:border-slate-700">
              <p>GPU: {gpuInfo.gpu_name || "Nicht erkannt"}</p>
              <p>VRAM: {gpuInfo.vram_total_mb > 0 ? `${Math.round(gpuInfo.vram_total_mb / 1024)} GB` : "\u2013"}</p>
              <p>CUDA: {gpuInfo.cuda_available ? "Ja" : "Nein"}</p>
              <p>nvidia-smi: {gpuInfo.nvidia_smi_available ? "Verfuegbar" : "Nicht gefunden"}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">Keine NVIDIA-GPU erkannt</span>
          </div>
        )}
      </Section>

      {/* Model-Cache */}
      <Section>
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <HardDrive size={18} aria-hidden="true" />
          Model-Cache
        </h2>

        {cacheInfo ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-slate-600 dark:text-slate-300">Pfad</span>
                <p className="font-mono text-xs text-slate-500 mt-0.5">{cacheInfo.cache_path}</p>
              </div>
              {isDesktop && (
                <button
                  onClick={handleChangeCachePath}
                  className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
                >
                  Aendern
                </button>
              )}
            </div>

            <InfoRow label="Groesse" value={`${(cacheInfo.total_size_mb / 1024).toFixed(1)} GB`} />
            <InfoRow label="Freier Speicher" value={`${(cacheInfo.free_space_mb / 1024).toFixed(1)} GB`} />

            {cacheInfo.models.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                {cacheInfo.models.map((m) => (
                  <div key={m.name} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${m.size_mb > 0 ? "bg-green-500" : "bg-neutral-300"}`} />
                      <span className="text-sm text-slate-600 dark:text-slate-300">{m.name}</span>
                    </div>
                    <span className="text-sm font-mono text-slate-500">
                      {m.size_mb > 0 ? `${(m.size_mb / 1024).toFixed(1)} GB` : "Nicht heruntergeladen"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {cacheInfo.models.length === 0 && (
              <p className="text-sm text-slate-400">Keine Modelle im Cache.</p>
            )}

            {cacheInfo.total_size_mb > 0 && (
              <div className="pt-3 flex justify-end">
                <button
                  onClick={() => setShowCacheConfirm(true)}
                  disabled={cacheClearing}
                  className="text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg px-4 py-2 flex items-center gap-2"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  {cacheClearing ? "Wird geloescht..." : "Cache loeschen"}
                </button>
              </div>
            )}

            {cacheError && (
              <p className="text-sm text-red-500" role="alert">{cacheError}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Backend nicht erreichbar</p>
        )}
      </Section>

      {/* Cache Delete Confirmation Dialog */}
      {showCacheConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCacheConfirm(false)}>
          <div
            role="alertdialog"
            aria-labelledby="cache-confirm-title"
            aria-describedby="cache-confirm-desc"
            className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-800 p-6 max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="cache-confirm-title" className="text-base font-semibold mb-2">Cache loeschen</h3>
            <p id="cache-confirm-desc" className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
              Alle heruntergeladenen Modelle werden entfernt. Beim naechsten Start werden sie automatisch neu heruntergeladen. Fortfahren?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCacheConfirm(false)}
                className="text-sm px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Abbrechen
              </button>
              <button
                onClick={handleClearCache}
                className="text-sm px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
              >
                Cache loeschen
              </button>
            </div>
          </div>
        </div>
      )}

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
