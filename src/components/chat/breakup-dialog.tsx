"use client";

import { HeartCrack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function BreakupDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="确认分手">
        <div className="mt-4 space-y-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
            <HeartCrack className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <p className="text-sm leading-6 text-text-muted">
              分手不会删除她。聊天记录、相册、语音和角色卡都会保留在个人中心里。之后你可以重新分配新女友,也可以和她重新联系。
            </p>
            <p className="text-sm text-text-subtle">
              今天剩余可分配次数: 2 / 3
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={onConfirm}>
              确认分手
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
