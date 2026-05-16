"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-10 w-full rounded-md bg-bg border border-border-strong px-3 text-sm text-text placeholder:text-text-subtle",
          "focus:outline-none focus:ring-0 focus:border-text",
          "disabled:cursor-not-allowed disabled:opacity-50",
          invalid && "border-danger focus:border-danger",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-md bg-bg border border-border-strong px-3 py-2 text-sm text-text placeholder:text-text-subtle resize-none",
        "focus:outline-none focus:ring-0 focus:border-text",
        "disabled:cursor-not-allowed disabled:opacity-50",
        invalid && "border-danger focus:border-danger",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-sm font-medium text-text-muted", className)}
      {...props}
    />
  );
}
