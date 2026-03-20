import React from "react";

interface ProgressBarProps {
  progress: number;
  total: number;
  label?: string;
}

export function ProgressBar({ progress, total, label }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
          <span>{label}</span>
          <span>
            {progress}/{total} ({pct}%)
          </span>
        </div>
      )}
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
        <div
          className="bg-primary-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
