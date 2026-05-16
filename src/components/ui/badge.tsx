import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium",
        tone === "neutral" && "border-border bg-bg-muted text-text-muted",
        tone === "success" && "border-success/20 bg-success/5 text-success",
        tone === "warning" && "border-warning/20 bg-warning/5 text-warning",
        tone === "danger" && "border-danger/20 bg-danger/5 text-danger",
        className,
      )}
      {...props}
    />
  );
}
