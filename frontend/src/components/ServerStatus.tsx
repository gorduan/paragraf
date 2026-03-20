import React from "react";

interface ServerStatusProps {
  state: string;
}

const STATE_CONFIG: Record<string, { color: string; label: string }> = {
  ready: { color: "bg-green-500", label: "Bereit" },
  connecting: { color: "bg-yellow-500 animate-pulse", label: "Verbinde..." },
  loading: { color: "bg-yellow-500 animate-pulse", label: "Modelle laden..." },
  error: { color: "bg-red-500", label: "Nicht erreichbar" },
};

export function ServerStatus({ state }: ServerStatusProps) {
  const config = STATE_CONFIG[state] || STATE_CONFIG.connecting;

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {config.label}
      </span>
    </div>
  );
}
