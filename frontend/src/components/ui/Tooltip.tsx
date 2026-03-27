import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export function TooltipProvider({
  delayDuration = 400,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  sideOffset = 4,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-caption px-sm py-1.5 rounded-sm shadow-sm max-w-[200px] data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=delayed-open]:fade-in-0 data-[state=closed]:fade-out-0",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-slate-900 dark:fill-slate-100" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
