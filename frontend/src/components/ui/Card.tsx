import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const cardVariants = cva("rounded-md border p-lg", {
  variants: {
    variant: {
      default:
        "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-md",
      interactive:
        "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-md hover:shadow-lg hover:bg-slate-50 dark:hover:bg-slate-750 transition-shadow cursor-pointer",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export function Card({ className, variant, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant }), className)} {...props} />;
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pb-sm", className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("py-sm", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("pt-sm flex items-center justify-end gap-sm", className)}
      {...props}
    />
  );
}
