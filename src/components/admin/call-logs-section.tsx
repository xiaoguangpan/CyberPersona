"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, RefreshCw } from "lucide-react";
import type { CallLogEntry, CallLogType } from "@/lib/types";
import { fetchAdminCallLogDetail, fetchAdminCallLogs } from "@/lib/services";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const tabs: { key: CallLogType; label: string; description: string }[] = [
  { key: "llm", label: "LLM 调用", description: "对话推理、JSON 输出、token 等" },
  { key: "image", label: "Image 调用", description: "首图与一致性图生成" },
  { key: "sticker", label: "表情包调用", description: "tangdouz 表情包搜索" },
];

const statusTone: Record<CallLogEntry["status"], "success" | "warning" | "danger" | "neutral"> = {
  ok: "success",
  fallback: "warning",
  error: "danger",
  unconfigured: "neutral",
};

const statusLabel: Record<CallLogEntry["status"], string> = {
  ok: "成功",
  fallback: "兜底",
  error: "失败",
  unconfigured: "未配置",
};

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return value;
  }
}

function formatDuration(ms: number) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms}ms`;
}

export function CallLogsSection() {
  const [active, setActive] = React.useState<CallLogType>("llm");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const logsQuery = useQuery({
    queryKey: ["adminCallLogs", active],
    queryFn: () => fetchAdminCallLogs(active, 100),
    refetchInterval: 5_000,
  });

  const detailQuery = useQuery({
    queryKey: ["adminCallLogDetail", selectedId],
    queryFn: () => (selectedId ? fetchAdminCallLogDetail(selectedId) : Promise.resolve(null)),
    enabled: Boolean(selectedId),
  });

  const logs = logsQuery.data ?? [];

  return (
    <section className="space-y-5">
      <SectionTitle
        title="AI 调用记录"
        description="LLM、Image、表情包接口的每次调用记录。每 5 秒自动刷新，可点击查看完整请求与响应。"
        action={
          <Button variant="secondary" size="sm" onClick={() => logsQuery.refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            手动刷新
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={`rounded-lg border px-4 py-2 text-left transition-colors ${
              active === tab.key
                ? "border-text bg-text text-bg"
                : "border-border bg-bg text-text-muted hover:bg-bg-muted"
            }`}
          >
            <p className="text-sm font-semibold">{tab.label}</p>
            <p className={`mt-0.5 text-2xs ${active === tab.key ? "text-bg/70" : "text-text-subtle"}`}>{tab.description}</p>
          </button>
        ))}
      </div>

      <Card className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>时间</TH>
              <TH>来源</TH>
              <TH>状态</TH>
              <TH>耗时</TH>
              <TH>流式</TH>
              <TH>输入摘要</TH>
              <TH>输出摘要</TH>
              <TH>操作</TH>
            </TR>
          </THead>
          <TBody>
            {logs.length === 0 ? (
              <TR>
                <TD colSpan={8} className="py-8 text-center text-sm text-text-subtle">
                  {logsQuery.isLoading ? "加载中…" : "暂无调用记录。先在“系统配置”里点击对应「测试连接」按钮试一下。"}
                </TD>
              </TR>
            ) : (
              logs.map((log) => (
                <TR key={log.id}>
                  <TD className="whitespace-nowrap font-mono text-2xs text-text-muted">{formatTime(log.startedAt)}</TD>
                  <TD className="text-2xs">{log.source}</TD>
                  <TD>
                    <Badge tone={statusTone[log.status]}>{statusLabel[log.status]}</Badge>
                  </TD>
                  <TD className="tabular-nums text-2xs">{formatDuration(log.durationMs)}</TD>
                  <TD className="text-2xs">{log.streaming ? "是" : "否"}</TD>
                  <TD className="max-w-[260px] truncate text-2xs text-text-muted" title={log.inputSummary}>
                    {log.inputSummary || "-"}
                  </TD>
                  <TD className="max-w-[260px] truncate text-2xs text-text-muted" title={log.outputSummary}>
                    {log.outputSummary || (log.errorMessage ? log.errorMessage : "-")}
                  </TD>
                  <TD>
                    <Button variant="secondary" size="sm" onClick={() => setSelectedId(log.id)}>
                      <Eye className="h-3.5 w-3.5" />详情
                    </Button>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </Card>

      <CallLogDetailSheet log={detailQuery.data ?? null} onOpenChange={(open) => !open && setSelectedId(null)} />
    </section>
  );
}

function CallLogDetailSheet({ log, onOpenChange }: { log: CallLogEntry | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={Boolean(log)} onOpenChange={onOpenChange}>
      <SheetContent title="调用详情" className="md:w-[640px]">
        {log ? (
          <div className="space-y-4">
            <Card className="space-y-2 p-4 text-sm">
              <Row label="ID" value={log.id} mono />
              <Row label="类型" value={log.type} />
              <Row label="Provider" value={log.provider} />
              <Row label="来源" value={log.source} />
              <Row label="时间" value={formatTime(log.startedAt)} />
              <Row label="耗时" value={formatDuration(log.durationMs)} />
              <Row label="是否流式" value={log.streaming ? "是" : "否"} />
              <Row label="状态" value={statusLabel[log.status]} />
              {log.errorMessage ? <Row label="错误" value={log.errorMessage} /> : null}
            </Card>
            <DetailBlock title="输入摘要" content={log.inputSummary || "(无)"} />
            <DetailBlock title="输出摘要" content={log.outputSummary || "(无)"} />
            <DetailBlock title="完整请求" content={JSON.stringify(log.request ?? null, null, 2)} mono />
            <DetailBlock title="完整响应" content={JSON.stringify(log.response ?? null, null, 2)} mono />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DetailBlock({ title, content, mono }: { title: string; content: string; mono?: boolean }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-text">{title}</p>
      <pre
        className={`max-h-[260px] overflow-auto rounded-md border border-border bg-bg-muted p-3 text-2xs leading-5 ${mono ? "font-mono" : ""}`}
      >
        {content}
      </pre>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-text-subtle">{label}</span>
      <span className={`text-right ${mono ? "font-mono text-2xs" : ""}`}>{value}</span>
    </div>
  );
}
