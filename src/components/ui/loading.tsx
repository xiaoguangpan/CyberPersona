import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-dot-bounce [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-dot-bounce [animation-delay:160ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-dot-bounce [animation-delay:320ms]" />
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-bg-muted", className)} />;
}
