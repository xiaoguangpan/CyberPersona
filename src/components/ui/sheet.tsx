"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/20 data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-hidden rounded-t-2xl border border-border bg-bg-elevated shadow-elev outline-none md:inset-y-0 md:left-auto md:right-0 md:h-full md:max-h-none md:w-[420px] md:rounded-none md:border-y-0 md:border-r-0",
          "data-[state=open]:animate-slide-up",
          className,
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          {title ? (
            <DialogPrimitive.Title className="text-sm font-semibold text-text">
              {title}
            </DialogPrimitive.Title>
          ) : (
            <DialogPrimitive.Title className="sr-only">详情</DialogPrimitive.Title>
          )}
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon-sm" aria-label="关闭">
              <X className="h-4 w-4" />
            </Button>
          </DialogPrimitive.Close>
        </div>
        <div className="h-[calc(90vh-3.5rem)] overflow-y-auto p-4 md:h-[calc(100vh-3.5rem)]">
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
