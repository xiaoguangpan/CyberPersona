"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, Database, Home, MessageCircle, Settings, Users } from "lucide-react";
import { AdminConsole } from "./admin-console";
import {
  fetchAdminOverview,
  fetchAdminPersonas,
  fetchAdminSettings,
  fetchAdminTurns,
  fetchAdminUsers,
} from "@/lib/services";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export function AdminScreen() {
  return <AdminConsole />;
}

export function AdminScreenLegacy() {
  const overview = useQuery({ queryKey: ["adminOverview"], queryFn: fetchAdminOverview });
  const users = useQuery({ queryKey: ["adminUsers"], queryFn: fetchAdminUsers });
  const personas = useQuery({ queryKey: ["adminPersonas"], queryFn: fetchAdminPersonas });
  const turns = useQuery({ queryKey: ["adminTurns"], queryFn: fetchAdminTurns });
  const settings = useQuery({ queryKey: ["adminSettings"], queryFn: fetchAdminSettings });

  return (
    <main className="min-h-screen bg-bg-subtle">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
        <aside className="hidden border-r border-border bg-bg px-4 py-5 md:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-bg-muted text-sm font-semibold">
              CP
            </div>
            <div>
              <p className="text-sm font-semibold text-text">平台后台</p>
              <p className="text-xs text-text-subtle">运营与调试</p>
            </div>
          </div>
          <nav className="space-y-1 text-sm">
            <Nav icon={<Activity className="h-4 w-4" />} text="总览" />
            <Nav icon={<Users className="h-4 w-4" />} text="用户" />
            <Nav icon={<Database className="h-4 w-4" />} text="女友" />
            <Nav icon={<MessageCircle className="h-4 w-4" />} text="Turn" />
            <Nav icon={<Settings className="h-4 w-4" />} text="配置" />
          </nav>
        </aside>

        <section>
          <header className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur">
            <div className="flex h-14 items-center justify-between px-4 md:px-6">
              <div>
                <h1 className="text-sm font-semibold text-text">CyberPersona Admin</h1>
                <p className="text-xs text-text-subtle">平台级管理,不展示给普通用户</p>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link href="/">
                  <Home className="h-4 w-4" />
                  返回聊天
                </Link>
              </Button>
            </div>
          </header>

          <div className="space-y-6 p-4 md:p-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="总用户" value={overview.data?.totalUsers ?? 0} />
              <Stat label="7日活跃" value={overview.data?.activeUsers7d ?? 0} />
              <Stat label="当前女友" value={overview.data?.activePersonas ?? 0} />
              <Stat label="今日消息" value={overview.data?.messagesToday ?? 0} />
            </div>

            <Tabs defaultValue="users" className="space-y-4">
              <TabsList className="flex-wrap">
                <TabsTrigger value="users">用户</TabsTrigger>
                <TabsTrigger value="personas">女友</TabsTrigger>
                <TabsTrigger value="turns">Turn 调试</TabsTrigger>
                <TabsTrigger value="settings">系统配置</TabsTrigger>
              </TabsList>

              <TabsContent value="users">
                <SectionTitle title="用户管理" description="平台级用户列表,用于封禁、排查和基础运营。" />
                <div className="mt-4">
                  <Table>
                    <THead>
                      <TR><TH>手机号</TH><TH>状态</TH><TH>当前女友</TH><TH>女友数</TH><TH>消息数</TH><TH>今日创建</TH></TR>
                    </THead>
                    <TBody>
                      {(users.data ?? []).slice(0, 12).map((u) => (
                        <TR key={u.id}>
                          <TD className="font-mono text-xs">{u.phone}</TD>
                          <TD><Badge tone={u.status === "active" ? "success" : "danger"}>{u.status}</Badge></TD>
                          <TD>{u.activePersonaName ?? "-"}</TD>
                          <TD>{u.totalPersonas}</TD>
                          <TD>{u.totalMessages}</TD>
                          <TD>{u.todayCreationCount} / 3</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="personas">
                <SectionTitle title="女友/角色管理" description="查看全平台角色状态。好感度仅在后台可见,不出现在用户聊天页。" />
                <div className="mt-4">
                  <Table>
                    <THead>
                      <TR><TH>昵称</TH><TH>用户</TH><TH>状态</TH><TH>类型</TH><TH>会话</TH><TH>信任</TH><TH>压力</TH><TH>好感</TH></TR>
                    </THead>
                    <TBody>
                      {(personas.data ?? []).slice(0, 14).map((p) => (
                        <TR key={p.id}>
                          <TD className="font-medium">{p.nickname}</TD>
                          <TD className="font-mono text-xs">{p.userPhone}</TD>
                          <TD><Badge tone={p.status === "active" ? "success" : p.status === "broken_up" ? "warning" : "neutral"}>{p.status}</Badge></TD>
                          <TD>{p.archetype}</TD>
                          <TD>{p.sessionCount}</TD>
                          <TD>{p.trust}</TD>
                          <TD>{p.stress}</TD>
                          <TD>{p.affection}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="turns">
                <SectionTitle title="对话调试记录" description="用于检查上下文、回复结果和多模态触发。" />
                <div className="mt-4">
                  <Table>
                    <THead>
                      <TR><TH>ID</TH><TH>女友</TH><TH>用户消息</TH><TH>回复</TH><TH>多模态</TH><TH>校验</TH><TH>延迟</TH></TR>
                    </THead>
                    <TBody>
                      {(turns.data ?? []).slice(0, 12).map((t) => (
                        <TR key={t.id}>
                          <TD className="font-mono text-xs">{t.id}</TD>
                          <TD>{t.personaName}</TD>
                          <TD className="max-w-[180px] truncate">{t.userMessage}</TD>
                          <TD className="max-w-[240px] truncate">{t.visibleText}</TD>
                          <TD>
                            <div className="flex gap-1">
                              {t.sendVoiceNow ? <Badge>Voice</Badge> : null}
                              {t.sendImageNow ? <Badge>Image</Badge> : null}
                              {t.sendGifNow ? <Badge>Gif</Badge> : null}
                              {!t.sendVoiceNow && !t.sendImageNow && !t.sendGifNow ? <span className="text-text-subtle">-</span> : null}
                            </div>
                          </TD>
                          <TD><Badge tone={t.validationStatus === "ok" ? "success" : t.validationStatus === "fallback" ? "warning" : "danger"}>{t.validationStatus}</Badge></TD>
                          <TD>{t.latencyMs}ms</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="settings">
                <SectionTitle title="系统配置" description="管理模型、媒体生成和运行时参数。" />
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <SettingCard title="LLM" rows={[
                    ["Provider", settings.data?.llm.provider],
                    ["Base URL", settings.data?.llm.baseUrl],
                    ["Model", settings.data?.llm.model],
                    ["API Key", settings.data?.llm.apiKeyMasked],
                    ["Temperature", settings.data?.llm.temperature],
                  ]} />
                  <SettingCard title="TTS" rows={[
                    ["Provider", settings.data?.tts.provider],
                    ["Base URL", settings.data?.tts.baseUrl],
                    ["Model", settings.data?.tts.model],
                    ["Voice Strategy", settings.data?.tts.voiceStrategy],
                    ["Format", settings.data?.tts.format],
                    ["API Key", settings.data?.tts.apiKeyMasked],
                    ["Enabled", settings.data?.tts.enabled ? "是" : "否"],
                  ]} />
                  <SettingCard title="ASR" rows={[
                    ["Provider", settings.data?.asr.provider],
                    ["Base URL", settings.data?.asr.baseUrl],
                    ["Model", settings.data?.asr.model],
                    ["API Key", settings.data?.asr.apiKeyMasked],
                    ["Enabled", settings.data?.asr.enabled ? "是" : "否"],
                  ]} />
                  <SettingCard title="LLM Audio" rows={[
                    ["Provider", settings.data?.llmAudio.provider],
                    ["Base URL", settings.data?.llmAudio.baseUrl],
                    ["Model", settings.data?.llmAudio.model],
                    ["API Key", settings.data?.llmAudio.apiKeyMasked],
                    ["Enabled", settings.data?.llmAudio.enabled ? "是" : "否"],
                  ]} />
                  <SettingCard title="Image" rows={[
                    ["Provider", settings.data?.image.provider],
                    ["Base URL", settings.data?.image.baseUrl],
                    ["Model", settings.data?.image.model],
                    ["API Key", settings.data?.image.apiKeyMasked],
                    ["Enabled", settings.data?.image.enabled ? "是" : "否"],
                  ]} />
                  <SettingCard title="Sticker" rows={[
                    ["Provider", settings.data?.sticker.provider],
                    ["API URL", settings.data?.sticker.apiUrl],
                    ["Enabled", settings.data?.sticker.enabled ? "是" : "否"],
                  ]} />
                  <SettingCard title="Runtime" rows={[
                    ["State File", settings.data?.runtime.stateFile],
                    ["History File", settings.data?.runtime.historyFile],
                    ["TTS Output Dir", settings.data?.runtime.ttsOutputDir],
                    ["Image Output Dir", settings.data?.runtime.imageOutputDir],
                    ["Debug", settings.data?.runtime.debug ? "是" : "否"],
                    ["Debug TTS", settings.data?.runtime.debugTts ? "是" : "否"],
                  ]} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </div>
    </main>
  );
}

function Nav({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex items-center gap-2 rounded-md px-3 py-2 text-text-muted hover:bg-bg-muted">{icon}{text}</div>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-text-subtle">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-text">{value.toLocaleString("zh-CN")}</p>
    </Card>
  );
}

function SettingCard({ title, rows }: { title: string; rows: [string, unknown][] }) {
  return (
    <Card className="p-4">
      <h3 className="mb-4 text-sm font-semibold text-text">{title}</h3>
      <dl className="space-y-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-text-subtle">{k}</dt>
            <dd className="text-right text-text-muted">{String(v ?? "-")}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
