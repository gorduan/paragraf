import { RotateCcw, Trash2 } from "lucide-react";
import { type SnapshotInfo } from "@/lib/api";
import { relativeTime } from "@/lib/relative-time";
import { Button } from "@/components/ui/Button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/Tooltip";

interface SnapshotCardProps {
  snapshot: SnapshotInfo;
  onRestore: (name: string) => void;
  onDelete: (name: string) => void;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function SnapshotCard({
  snapshot,
  onRestore,
  onDelete,
  disabled,
}: SnapshotCardProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
          {snapshot.name}
        </p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {snapshot.creation_time
            ? relativeTime(snapshot.creation_time)
            : "Unbekannt"}{" "}
          &middot; {formatBytes(snapshot.size)}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className="min-h-[44px] min-w-[44px]"
              aria-label="Wiederherstellen"
              disabled={disabled}
              onClick={() => onRestore(snapshot.name)}
            >
              <RotateCcw size={16} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Wiederherstellen</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className="min-h-[44px] min-w-[44px] text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
              aria-label="Loeschen"
              disabled={disabled}
              onClick={() => onDelete(snapshot.name)}
            >
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Loeschen</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
