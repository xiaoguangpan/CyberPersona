"use client";

import * as React from "react";
import Link from "next/link";
import { Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function CooldownOverlay({
  cooldownUntil,
  breakupCountToday,
  lastBrokenPersonaId,
  onComplete,
}: {
  cooldownUntil: string;
  breakupCountToday: number;
  lastBrokenPersonaId?: string;
  onComplete: () => void;
}) {
  const [now, setNow] = React.useState(() => Date.now());
  const target = new Date(cooldownUntil).getTime();
  const remainingMs = Math.max(0, target - now);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-bg/95 px-4 backdrop-blur-md">
      <Card className="w-full max-w-[460px] p-7 text-center shadow-elev">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-bg-muted">
          <Hourglass className="h-6 w-6 text-text-muted" />
        </div>
        <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-text-subtle">
          第 {breakupCountToday} 次分手冷静期
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-text tabular-nums">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </h1>
        <p className="mt-5 text-sm leading-7 text-text-muted">
          每段关系都需要被慢慢养成。与其一直在河边寻找一颗天然契合的鹅卵石，不如把已经捡起的那一颗，耐心打磨成彼此都舒服的形状。
        </p>
        <div className="mt-6 rounded-lg border border-border bg-bg-muted px-4 py-3 text-left text-xs leading-6 text-text-subtle">
          冷静期由后端状态控制。冷静期内不能随机分配新女友，但可以从历史关系里尝试重新联系刚分手的女友。
        </div>
        <div className="mt-5 grid gap-2">
          {lastBrokenPersonaId ? (
            <Button asChild variant="secondary" className="w-full">
              <Link href={`/me/personas/${lastBrokenPersonaId}`}>查看这段关系</Link>
            </Button>
          ) : (
            <Button asChild variant="secondary" className="w-full">
              <Link href="/me">查看历史关系</Link>
            </Button>
          )}
          {remainingMs <= 0 ? (
            <Button className="w-full" onClick={onComplete}>
              分配新女友
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
