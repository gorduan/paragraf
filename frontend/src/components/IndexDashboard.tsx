import React from "react";
import {
  Database,
  CheckCircle,
  Clock,
  Loader,
  XCircle,
  Layers,
  Zap,
} from "lucide-react";
import type { IndexStatusItem, LawInfo } from "../lib/api";

interface IndexDashboardProps {
  laws: LawInfo[];
  statusItems: IndexStatusItem[];
  totalChunks: number;
  queue: string[];
  queuePos: number;
  indexingGesetz: string | null;
  completedInSession: Set<string>;
  failedInSession: Set<string>;
  embeddingProgress: { current: number; total: number } | null;
}

/* ── SVG Donut ──────────────────────────────────────────────────────────── */

function DonutChart({
  segments,
  size = 140,
  stroke = 16,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  stroke?: number;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;

  let offset = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {segments
          .filter((s) => s.value > 0)
          .map((seg, i) => {
            const pct = seg.value / total;
            const dash = pct * circumference;
            const gap = circumference - dash;
            const currentOffset = offset;
            offset += dash;

            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-currentOffset}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            );
          })}
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          {total}
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Gesetze
        </span>
      </div>
    </div>
  );
}

/* ── Stat Card ──────────────────────────────────────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className={`p-2 rounded-lg ${accent}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {label}
        </p>
        {sub && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Queue Pipeline ─────────────────────────────────────────────────────── */

function QueuePipeline({
  queue,
  queuePos,
  indexingGesetz,
  completedInSession,
  failedInSession,
  embeddingProgress,
}: {
  queue: string[];
  queuePos: number;
  indexingGesetz: string | null;
  completedInSession: Set<string>;
  failedInSession: Set<string>;
  embeddingProgress: { current: number; total: number } | null;
}) {
  if (queue.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
        <Layers size={12} />
        Queue-Pipeline ({queuePos}/{queue.length})
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {queue.map((name, i) => {
          const isDone = completedInSession.has(name);
          const isFailed = failedInSession.has(name);
          const isActive = name === indexingGesetz;
          const isWaiting = !isDone && !isFailed && !isActive;

          // Embedding % for active
          let pct = 0;
          if (isActive && embeddingProgress) {
            pct = Math.round(
              (embeddingProgress.current / embeddingProgress.total) * 100
            );
          }

          return (
            <div
              key={name}
              className={`relative overflow-hidden rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-all duration-500 ${
                isDone
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                  : isFailed
                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800"
                  : isActive
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 ring-2 ring-blue-400/50 ring-offset-1 dark:ring-offset-slate-800"
                  : isWaiting
                  ? "bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600"
                  : ""
              }`}
              title={
                isDone
                  ? `${name}: Fertig`
                  : isFailed
                  ? `${name}: Fehler`
                  : isActive
                  ? `${name}: ${pct}%`
                  : `${name}: Warteschlange`
              }
            >
              {/* Progress fill for active item */}
              {isActive && embeddingProgress && (
                <div
                  className="absolute inset-y-0 left-0 bg-blue-200/50 dark:bg-blue-700/30 transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              )}
              <span className="relative flex items-center gap-1">
                {isDone && <CheckCircle size={10} />}
                {isFailed && <XCircle size={10} />}
                {isActive && (
                  <Loader size={10} className="animate-spin" />
                )}
                {isWaiting && <Clock size={10} className="opacity-50" />}
                {name}
                {isActive && embeddingProgress && (
                  <span className="ml-0.5 text-[10px] opacity-70">
                    {pct}%
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main Dashboard ─────────────────────────────────────────────────────── */

export function IndexDashboard({
  laws,
  statusItems,
  totalChunks,
  queue,
  queuePos,
  indexingGesetz,
  completedInSession,
  failedInSession,
  embeddingProgress,
}: IndexDashboardProps) {
  const statusMap = new Map(statusItems.map((s) => [s.gesetz, s]));

  // Counts
  const indexed = laws.filter(
    (l) => (statusMap.get(l.abkuerzung)?.chunks ?? 0) > 0
  ).length;
  const open = laws.length - indexed;
  const sessionDone = completedInSession.size;
  const sessionFailed = failedInSession.size;
  const inProgress = indexingGesetz ? 1 : 0;
  const queued = Math.max(
    0,
    queue.length - queuePos - inProgress
  );

  // Donut segments
  const alreadyIndexed = indexed - sessionDone; // pre-session indexed
  const segments = [
    {
      value: Math.max(0, alreadyIndexed),
      color: "#10b981", // emerald-500
      label: "Bereits indexiert",
    },
    {
      value: sessionDone,
      color: "#06d6a0", // bright green
      label: "Gerade abgeschlossen",
    },
    {
      value: inProgress,
      color: "#3b82f6", // blue-500
      label: "Wird indexiert",
    },
    {
      value: queued,
      color: "#f59e0b", // amber-500
      label: "Warteschlange",
    },
    {
      value: sessionFailed,
      color: "#ef4444", // red-500
      label: "Fehlgeschlagen",
    },
    {
      value: Math.max(0, open - queued - inProgress - sessionFailed),
      color: "#cbd5e1", // slate-300
      label: "Noch offen",
    },
  ];

  const showQueuePipeline = queue.length > 0;

  return (
    <div className="mb-6 space-y-4">
      {/* Stats + Donut row */}
      <div className="flex gap-4 items-start flex-wrap lg:flex-nowrap">
        {/* Donut */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <DonutChart segments={segments} />
          {/* Legend */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
            {segments
              .filter((s) => s.value > 0)
              .map((seg) => (
                <div key={seg.label} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-slate-500 dark:text-slate-400">
                    {seg.label}
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 ml-auto">
                    {seg.value}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Stat Cards Grid */}
        <div className="grid grid-cols-2 gap-3 flex-1 min-w-0">
          <StatCard
            icon={Database}
            label="Gesamt-Chunks"
            value={totalChunks}
            accent="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
          />
          <StatCard
            icon={CheckCircle}
            label="Indexiert"
            value={indexed}
            sub={`von ${laws.length} Gesetzen`}
            accent="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
          />
          {sessionDone > 0 && (
            <StatCard
              icon={Zap}
              label="Diese Session abgeschlossen"
              value={sessionDone}
              accent="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
            />
          )}
          {inProgress > 0 && (
            <StatCard
              icon={Loader}
              label="Wird gerade indexiert"
              value={indexingGesetz || ""}
              sub={
                embeddingProgress
                  ? `${embeddingProgress.current}/${embeddingProgress.total} Chunks`
                  : "Startet..."
              }
              accent="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
            />
          )}
          {queued > 0 && (
            <StatCard
              icon={Clock}
              label="In Warteschlange"
              value={queued}
              sub="Gesetze warten"
              accent="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
            />
          )}
          {sessionFailed > 0 && (
            <StatCard
              icon={XCircle}
              label="Fehlgeschlagen"
              value={sessionFailed}
              accent="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
            />
          )}
          {open > 0 && !indexingGesetz && (
            <StatCard
              icon={Clock}
              label="Noch offen"
              value={open}
              sub="Nicht indexiert"
              accent="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
            />
          )}
        </div>
      </div>

      {/* Queue Pipeline */}
      {showQueuePipeline && (
        <QueuePipeline
          queue={queue}
          queuePos={queuePos}
          indexingGesetz={indexingGesetz}
          completedInSession={completedInSession}
          failedInSession={failedInSession}
          embeddingProgress={embeddingProgress}
        />
      )}
    </div>
  );
}
