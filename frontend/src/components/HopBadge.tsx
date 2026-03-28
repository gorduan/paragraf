import { cn } from "@/lib/utils";

interface HopBadgeProps {
  hop: number;
}

const HOP_STYLES: Record<number, { bg: string; text: string; label: string }> = {
  0: {
    bg: "bg-primary-100 dark:bg-primary-900",
    text: "text-primary-700 dark:text-primary-200",
    label: "Direkttreffer",
  },
  1: {
    bg: "bg-warning-100 dark:bg-warning-900",
    text: "text-warning-600 dark:text-warning-100",
    label: "1. Verweis",
  },
  2: {
    bg: "bg-success-100 dark:bg-success-900",
    text: "text-success-600 dark:text-success-100",
    label: "2. Verweis",
  },
};

export function HopBadge({ hop }: HopBadgeProps) {
  const style = HOP_STYLES[hop] ?? HOP_STYLES[2];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold",
        style.bg,
        style.text
      )}
      aria-label={`Hop ${hop}`}
    >
      {style.label}
    </span>
  );
}
