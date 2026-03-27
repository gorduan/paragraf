import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center px-1 py-0.5 text-caption font-semibold rounded-sm",
  {
    variants: {
      variant: {
        default:
          "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
        primary:
          "bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300",
        success:
          "bg-success-50 text-success-700 dark:bg-success-900 dark:text-success-300",
        warning:
          "bg-warning-50 text-warning-700 dark:bg-warning-900 dark:text-warning-300",
        error:
          "bg-error-50 text-error-700 dark:bg-error-900 dark:text-error-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
