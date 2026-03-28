import { useEffect } from "react";
import { X } from "lucide-react";

interface UndoSnackbarProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number;
}

export function UndoSnackbar({
  message,
  onUndo,
  onDismiss,
  duration = 5000,
}: UndoSnackbarProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-neutral-800 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg px-4 py-3 shadow-lg"
    >
      <span className="text-sm">{message}</span>

      <button
        onClick={onUndo}
        className="text-sm font-medium text-primary-300 dark:text-primary-600 hover:text-primary-200 dark:hover:text-primary-500"
      >
        Rueckgaengig
      </button>

      <button
        onClick={onDismiss}
        aria-label="Schliessen"
        className="ml-1 text-neutral-400 dark:text-neutral-500 hover:text-white dark:hover:text-neutral-900"
      >
        <X size={16} aria-hidden="true" />
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-lg">
        <div
          className="h-full bg-primary-400 dark:bg-primary-500"
          style={{
            animation: `shrink ${duration}ms linear forwards`,
          }}
        />
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
