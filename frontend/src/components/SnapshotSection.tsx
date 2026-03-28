import { useState, useEffect, useCallback } from "react";
import { Camera, Loader } from "lucide-react";
import { api, type SnapshotInfo } from "@/lib/api";
import { relativeTime } from "@/lib/relative-time";
import { SnapshotCard } from "@/components/SnapshotCard";
import { Button } from "@/components/ui/Button";
import { TooltipProvider } from "@/components/ui/Tooltip";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";

interface SnapshotSectionProps {
  onAutoSnapshotChange?: (enabled: boolean) => void;
}

export function SnapshotSection({ onAutoSnapshotChange }: SnapshotSectionProps) {
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [autoSnapshot, setAutoSnapshot] = useState(
    () => localStorage.getItem("paragraf-auto-snapshot") === "true"
  );
  const [confirmAction, setConfirmAction] = useState<{
    type: "restore" | "delete";
    snapshot: SnapshotInfo;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [srAnnouncement, setSrAnnouncement] = useState("");

  const announce = useCallback((msg: string) => {
    setSrAnnouncement(msg);
  }, []);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listSnapshots();
      setSnapshots(res.snapshots);
    } catch (e) {
      console.error("Snapshots konnten nicht geladen werden:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  const handleCreate = async () => {
    setCreating(true);
    setStatusMessage(null);
    try {
      const res = await api.createSnapshot();
      setStatusMessage(`Snapshot "${res.name}" wurde erstellt`);
      announce(`Snapshot ${res.name} wurde erstellt`);
      await loadSnapshots();
    } catch {
      setStatusMessage(
        "Snapshot konnte nicht erstellt werden. Bitte versuchen Sie es erneut."
      );
      announce("Snapshot konnte nicht erstellt werden");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleAuto = () => {
    const next = !autoSnapshot;
    setAutoSnapshot(next);
    localStorage.setItem("paragraf-auto-snapshot", String(next));
    onAutoSnapshotChange?.(next);
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const { type, snapshot } = confirmAction;

    if (type === "restore") {
      setRestoring(true);
      try {
        await api.restoreSnapshot(snapshot.name);
        setStatusMessage(`Snapshot "${snapshot.name}" wurde wiederhergestellt`);
        announce(`Snapshot ${snapshot.name} wurde wiederhergestellt`);
        await loadSnapshots();
      } catch {
        setStatusMessage("Wiederherstellung fehlgeschlagen. Bitte versuchen Sie es erneut.");
        announce("Wiederherstellung fehlgeschlagen");
      } finally {
        setRestoring(false);
      }
    } else {
      try {
        await api.deleteSnapshot(snapshot.name);
        setStatusMessage(`Snapshot "${snapshot.name}" wurde geloescht`);
        announce(`Snapshot ${snapshot.name} wurde geloescht`);
        await loadSnapshots();
      } catch {
        setStatusMessage("Loeschen fehlgeschlagen. Bitte versuchen Sie es erneut.");
        announce("Loeschen fehlgeschlagen");
      }
    }

    setConfirmAction(null);
  };

  const isDialogOpen = confirmAction !== null;
  const isBusy = creating || restoring;

  return (
    <section aria-label="Snapshots" className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Snapshots
        </h2>
        <Button
          variant="primary"
          size="sm"
          disabled={isBusy}
          onClick={handleCreate}
        >
          {creating ? (
            <Loader size={14} className="animate-spin mr-1.5" aria-hidden="true" />
          ) : (
            <Camera size={14} className="mr-1.5" aria-hidden="true" />
          )}
          Snapshot erstellen
        </Button>
      </div>

      {/* Auto-snapshot toggle */}
      <label className="flex items-start gap-2 mb-4 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={autoSnapshot}
          onChange={handleToggleAuto}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
        />
        <div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Auto-Snapshot vor Indexierung
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Erstellt automatisch einen Snapshot bevor eine Indexierung gestartet
            wird. Maximal 3 Snapshots werden aufbewahrt.
          </p>
        </div>
      </label>

      {/* Status message */}
      {statusMessage && (
        <p
          className="mb-3 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2"
          role="status"
        >
          {statusMessage}
        </p>
      )}

      {/* Snapshot list */}
      {loading ? (
        <div className="flex justify-center py-6" role="status" aria-live="polite">
          <Loader size={20} className="animate-spin text-primary-500" aria-hidden="true" />
          <span className="sr-only">Snapshots werden geladen...</span>
        </div>
      ) : snapshots.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Keine Snapshots vorhanden
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Erstellen Sie einen Snapshot, um den aktuellen Stand der Datenbank zu
            sichern.
          </p>
        </div>
      ) : (
        <TooltipProvider>
          <div className="space-y-2">
            {snapshots.map((s) => (
              <SnapshotCard
                key={s.name}
                snapshot={s}
                onRestore={(name) =>
                  setConfirmAction({
                    type: "restore",
                    snapshot: snapshots.find((sn) => sn.name === name)!,
                  })
                }
                onDelete={(name) =>
                  setConfirmAction({
                    type: "delete",
                    snapshot: snapshots.find((sn) => sn.name === name)!,
                  })
                }
                disabled={isBusy}
              />
            ))}
          </div>
        </TooltipProvider>
      )}

      {/* Confirmation Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        {confirmAction && (
          <DialogContent>
            <DialogTitle>
              {confirmAction.type === "restore"
                ? "Snapshot wiederherstellen?"
                : "Snapshot loeschen?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction.type === "restore"
                ? `Die aktuelle Datenbank wird durch den Stand von "${confirmAction.snapshot.name}" (${confirmAction.snapshot.creation_time ? relativeTime(confirmAction.snapshot.creation_time) : "unbekannt"}) ersetzt. Dieser Vorgang kann nicht rueckgaengig gemacht werden.`
                : `Der Snapshot "${confirmAction.snapshot.name}" wird unwiderruflich geloescht.`}
            </DialogDescription>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmAction(null)}
              >
                Abbrechen
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isBusy}
                onClick={handleConfirm}
              >
                {confirmAction.type === "restore"
                  ? "Jetzt wiederherstellen"
                  : "Endgueltig loeschen"}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Screen-reader announcements */}
      <div aria-live="polite" className="sr-only" role="status">
        {srAnnouncement}
      </div>
    </section>
  );
}
