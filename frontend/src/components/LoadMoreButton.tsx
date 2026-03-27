import { Loader } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface LoadMoreButtonProps {
  loaded: number;
  total: number;
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export function LoadMoreButton({ loaded, total, loading, hasMore, onLoadMore }: LoadMoreButtonProps) {
  if (!hasMore && loaded > 0) {
    return (
      <div className="py-4 space-y-2">
        <p className="text-center text-sm text-neutral-500">{`Alle ${total} Ergebnisse angezeigt`}</p>
      </div>
    );
  }

  if (!hasMore) return null;

  return (
    <div className="py-4 space-y-2">
      <p className="text-center text-sm text-neutral-500" aria-live="polite">
        {loaded} von ~{total} Ergebnissen
      </p>
      <Button
        variant="secondary"
        size="md"
        onClick={onLoadMore}
        disabled={loading}
        className="mx-auto block"
      >
        {loading ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader className="animate-spin" size={14} aria-hidden="true" />
            Lade weitere...
          </span>
        ) : (
          "Mehr laden"
        )}
      </Button>
    </div>
  );
}
