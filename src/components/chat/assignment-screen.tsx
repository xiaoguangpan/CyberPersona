"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";

// Each step has a fixed weight (rough estimate of how long it takes in
// real seconds) so the progress bar advances at a sensible pace and slows
// down on the heavy "选衣服" / "拍照" steps where image generation actually
// runs. Total weight maps to ~25 seconds of expected wait, but the bar
// asymptotically approaches 95% (never hits 100% before the request
// finishes), so a slow image API doesn't make it look stuck.
const steps = [
  { weight: 2.0, label: "正在挑选今天最闪亮的姑娘…" },
  { weight: 1.6, label: "正在确定她的性格底色（OCEAN 五维）…" },
  { weight: 1.6, label: "正在为她搭配最合适的发型与发色…" },
  { weight: 1.4, label: "正在挑选今天的瞳色与妆感…" },
  { weight: 5.5, label: "正在为她挑选今天的衣服…" },
  { weight: 5.5, label: "正在选定外景：花海 / 海边 / 校园 / 图书馆 / 庭院…" },
  { weight: 3.5, label: "正在帮她拍下第一张生活照…" },
  { weight: 2.0, label: "正在调音色 — 给她一把好听的嗓子…" },
  { weight: 1.5, label: "正在写她见到你的第一句话…" },
  { weight: 0.4, label: "马上见面～" },
];

const totalWeight = steps.reduce((sum, step) => sum + step.weight, 0);
const tickIntervalMs = 220; // bar update cadence
const targetSeconds = 25;   // expected total runtime when image API is up
const ratePerTick = (1 / targetSeconds) * (tickIntervalMs / 1000);

export function AssignmentScreen() {
  const [progress, setProgress] = React.useState(0);

  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAt) / 1000));
      setProgress((prev) => {
        // Hard ceiling 0.95 so the bar never visually completes until the
        // network call actually returns and the parent unmounts us. We still
        // overlay a perpetual shimmer animation so the page never *looks*
        // frozen even after we've capped progress.
        if (prev >= 0.95) return 0.95;
        // Slow down as we approach the ceiling for a natural "easing" feel.
        const remaining = 0.95 - prev;
        return prev + Math.max(ratePerTick * 0.4, remaining * 0.05);
      });
    }, tickIntervalMs);
    return () => clearInterval(id);
  }, []);

  const stepIndex = pickStep(progress);
  const step = steps[stepIndex];
  const percent = Math.min(99, Math.round(progress * 100));
  const ceilingHit = progress >= 0.94;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <Card className="w-full max-w-md p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-pink-100 text-2xl animate-pulse">
          💗
        </div>
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-text">
          正在为你准备一位新女友
        </h1>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          人格、外貌、嗓音、第一张生活照都是现挑现做的，请稍等一会儿。
        </p>

        <div className="mt-6 space-y-3 text-left">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-pink-400 via-rose-400 to-fuchsia-400 transition-[width] duration-200 ease-out"
              style={{ width: `${percent}%` }}
            />
            {/* Perpetual shimmer overlay so the bar never looks frozen, even at 95%. */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
              <div className="h-full w-1/3 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
            </div>
          </div>
          <div className="flex items-center justify-between text-2xs">
            <span className="flex items-center gap-2 text-text-muted">
              <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-rose-400" />
              {step.label}
            </span>
            <span className="tabular-nums text-text-subtle">
              {percent}% · {elapsed}s
            </span>
          </div>
          {ceilingHit ? (
            <p className="text-2xs text-text-subtle">
              图像生成稍久，正在等待图片接口返回，页面没有卡，请稍候…
            </p>
          ) : null}
        </div>

        <ul className="mt-5 space-y-1 text-left text-2xs text-text-subtle">
          {steps.map((item, index) => (
            <li
              key={item.label}
              className={
                index < stepIndex
                  ? "text-success line-through decoration-success/50"
                  : index === stepIndex
                    ? "text-text"
                    : ""
              }
            >
              {index < stepIndex ? "✓ " : index === stepIndex ? "• " : "○ "}
              {item.label}
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}

function pickStep(progress: number): number {
  let acc = 0;
  for (let index = 0; index < steps.length; index += 1) {
    acc += steps[index].weight / totalWeight;
    if (progress < acc) return index;
  }
  return steps.length - 1;
}
