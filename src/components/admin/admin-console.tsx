"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  Ban,
  Coins,
  Database,
  Eye,
  Home,
  ListChecks,
  MessageCircle,
  PlayCircle,
  Save,
  Settings,
  Trash2,
  Users,
} from "lucide-react";
import type { AdminChatRecord, AdminProviderSettings, AdminUserRow, PersonaStatus } from "@/lib/types";
import {
  deleteAdminUser,
  fetchAdminChats,
  fetchAdminOverview,
  fetchAdminPersonas,
  fetchAdminSettings,
  fetchAdminUsers,
  fetchCurrentUser,
  resetAdminUserPassword,
  setAdminUserRole,
  testAdminImage,
  testAdminLlm,
  testAdminTts,
  updateAdminSettings,
  updateAdminUserCredits,
  updateAdminUserStatus,
  type AdminTestResult,
} from "@/lib/services";
import { CallLogsSection } from "@/components/admin/call-logs-section";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const userStatusLabel: Record<AdminUserRow["status"], string> = {
  active: "正常",
  disabled: "已停用",
  deleted: "已删除",
};

const relationshipLabel: Record<AdminUserRow["relationshipStatus"], string> = {
  active: "有当前女友",
  cooldown: "冷静期",
  unassigned: "无当前女友",
};

const personaStatusLabel: Record<PersonaStatus, string> = {
  active: "当前",
  broken_up: "已分手",
  reconciliation_pending: "待复合",
  archived: "已归档",
};

type AdminSection = "overview" | "users" | "credits" | "personas" | "chats" | "logs" | "settings";
type AdminOverview = Awaited<ReturnType<typeof fetchAdminOverview>>;

export function AdminConsole() {
  const [section, setSection] = React.useState<AdminSection>("overview");
  const [selectedChat, setSelectedChat] = React.useState<AdminChatRecord | null>(null);
  const [creditUser, setCreditUser] = React.useState<AdminUserRow | null>(null);
  const [creditValue, setCreditValue] = React.useState("0");
  const [resetResult, setResetResult] = React.useState<{ phone: string; password: string } | null>(null);
  const [localUsers, setLocalUsers] = React.useState<AdminUserRow[]>([]);
  const [settingsDraft, setSettingsDraft] = React.useState<AdminProviderSettings | null>(null);
  const [settingsSaved, setSettingsSaved] = React.useState(false);

  const overview = useQuery({ queryKey: ["adminOverview"], queryFn: fetchAdminOverview });
  const users = useQuery({ queryKey: ["adminUsers"], queryFn: fetchAdminUsers });
  const personas = useQuery({ queryKey: ["adminPersonas"], queryFn: fetchAdminPersonas });
  const chats = useQuery({ queryKey: ["adminChats"], queryFn: fetchAdminChats });
  const settings = useQuery({ queryKey: ["adminSettings"], queryFn: fetchAdminSettings });
  const me = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser });

  const statusMutation = useMutation({ mutationFn: updateAdminUserStatus });
  const deleteMutation = useMutation({ mutationFn: deleteAdminUser });
  const resetMutation = useMutation({ mutationFn: resetAdminUserPassword });
  const creditMutation = useMutation({ mutationFn: updateAdminUserCredits });
  const settingsMutation = useMutation({ mutationFn: updateAdminSettings });
  const roleMutation = useMutation({ mutationFn: setAdminUserRole });

  React.useEffect(() => {
    if (users.data) setLocalUsers(users.data);
  }, [users.data]);

  React.useEffect(() => {
    if (settings.data && !settingsDraft) setSettingsDraft(settings.data);
  }, [settings.data, settingsDraft]);

  function openCreditDialog(user: AdminUserRow) {
    setCreditUser(user);
    setCreditValue(String(user.credits));
  }

  async function setUserStatus(user: AdminUserRow, status: AdminUserRow["status"]) {
    await statusMutation.mutateAsync({ userId: user.id, status });
    setLocalUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, status } : item)));
  }

  async function deleteUser(user: AdminUserRow) {
    await deleteMutation.mutateAsync(user.id);
    setLocalUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, status: "deleted" } : item)));
  }

  async function resetPassword(user: AdminUserRow) {
    const result = await resetMutation.mutateAsync(user.id);
    setResetResult({ phone: user.phone, password: result.temporaryPassword });
  }

  async function setUserRole(user: AdminUserRow, isAdmin: boolean) {
    try {
      await roleMutation.mutateAsync({ userId: user.id, isAdmin });
      setLocalUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, isAdmin } : item)));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "更新管理员权限失败");
    }
  }

  async function saveCredits() {
    if (!creditUser) return;
    const credits = Math.max(0, Number(creditValue || 0));
    await creditMutation.mutateAsync({ userId: creditUser.id, credits });
    setLocalUsers((prev) => prev.map((item) => (item.id === creditUser.id ? { ...item, credits } : item)));
    setCreditUser(null);
  }

  async function saveSettings() {
    if (!settingsDraft) return;
    const saved = await settingsMutation.mutateAsync(settingsDraft);
    setSettingsDraft(saved);
    setSettingsSaved(true);
    window.setTimeout(() => setSettingsSaved(false), 1600);
  }

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
              <p className="text-xs text-text-subtle">系统管理</p>
            </div>
          </div>
          <nav className="space-y-1 text-sm">
            <Nav active={section === "overview"} icon={<Activity className="h-4 w-4" />} text="总览" onClick={() => setSection("overview")} />
            <Nav active={section === "users"} icon={<Users className="h-4 w-4" />} text="用户管理" onClick={() => setSection("users")} />
            <Nav active={section === "credits"} icon={<Coins className="h-4 w-4" />} text="积分管理" onClick={() => setSection("credits")} />
            <Nav active={section === "personas"} icon={<Database className="h-4 w-4" />} text="女友列表" onClick={() => setSection("personas")} />
            <Nav active={section === "chats"} icon={<MessageCircle className="h-4 w-4" />} text="聊天记录" onClick={() => setSection("chats")} />
            <Nav active={section === "logs"} icon={<ListChecks className="h-4 w-4" />} text="AI 调用记录" onClick={() => setSection("logs")} />
            <Nav active={section === "settings"} icon={<Settings className="h-4 w-4" />} text="系统配置" onClick={() => setSection("settings")} />
          </nav>
        </aside>

        <section>
          <header className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur">
            <div className="flex h-14 items-center justify-between px-4 md:px-6">
              <div>
                <h1 className="text-sm font-semibold text-text">CyberPersona Admin</h1>
                <p className="text-xs text-text-subtle">用户、女友、聊天与系统配置</p>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link href="/">
                  <Home className="h-4 w-4" />
                  返回聊天
                </Link>
              </Button>
            </div>
          </header>

          <div className="border-b border-border bg-bg px-4 py-3 md:hidden">
            <div className="grid grid-cols-3 gap-2">
              <MobileNav active={section === "overview"} text="总览" onClick={() => setSection("overview")} />
              <MobileNav active={section === "users"} text="用户" onClick={() => setSection("users")} />
              <MobileNav active={section === "credits"} text="积分" onClick={() => setSection("credits")} />
              <MobileNav active={section === "personas"} text="女友" onClick={() => setSection("personas")} />
              <MobileNav active={section === "chats"} text="聊天" onClick={() => setSection("chats")} />
              <MobileNav active={section === "logs"} text="调用记录" onClick={() => setSection("logs")} />
              <MobileNav active={section === "settings"} text="配置" onClick={() => setSection("settings")} />
            </div>
          </div>

          <div className="space-y-6 p-4 md:p-6">
            {section === "overview" ? <OverviewSection overview={overview.data} users={localUsers} /> : null}
            {section === "users" ? (
              <UsersSection
                users={localUsers}
                meId={me.data?.id ?? null}
                onEditCredits={openCreditDialog}
                onDisable={(user) => setUserStatus(user, "disabled")}
                onEnable={(user) => setUserStatus(user, "active")}
                onDelete={deleteUser}
                onResetPassword={resetPassword}
                onSetRole={setUserRole}
              />
            ) : null}
            {section === "credits" ? (
              <CreditsSection users={localUsers} settings={settingsDraft} onEditCredits={openCreditDialog} />
            ) : null}
            {section === "personas" ? <PersonasSection personas={personas.data ?? []} /> : null}
            {section === "chats" ? <ChatsSection chats={chats.data ?? []} onOpen={setSelectedChat} /> : null}
            {section === "logs" ? <CallLogsSection /> : null}
            {section === "settings" ? (
              <SettingsSection
                draft={settingsDraft}
                saved={settingsSaved}
                onChange={setSettingsDraft}
                onSave={saveSettings}
              />
            ) : null}
          </div>
        </section>
      </div>

      <CreditDialog
        user={creditUser}
        value={creditValue}
        onValueChange={setCreditValue}
        onOpenChange={(open) => {
          if (!open) setCreditUser(null);
        }}
        onSave={saveCredits}
      />
      <ResetPasswordDialog result={resetResult} onOpenChange={(open) => !open && setResetResult(null)} />
      <ChatDetailSheet chat={selectedChat} onOpenChange={(open) => !open && setSelectedChat(null)} />
    </main>
  );
}

function OverviewSection({ overview, users }: { overview?: AdminOverview; users: AdminUserRow[] }) {
  const disabledUsers = users.filter((user) => user.status === "disabled").length;
  const deletedUsers = users.filter((user) => user.status === "deleted").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="总用户" value={overview?.totalUsers ?? 0} />
        <Stat label="7日活跃" value={overview?.activeUsers7d ?? 0} />
        <Stat label="当前女友" value={overview?.activePersonas ?? 0} />
        <Stat label="今日消息" value={overview?.messagesToday ?? 0} />
        <Stat label="今日消耗积分" value={overview?.creditsConsumedToday ?? 0} />
        <Stat label="冷静期用户" value={overview?.usersInCooldown ?? 0} />
        <Stat label="停用用户" value={disabledUsers} />
        <Stat label="已删除用户" value={deletedUsers} />
      </div>
      <Card className="p-5">
        <SectionTitle title="运行状态" description="查看用户、关系、消息和积分消耗的实时概览。" />
      </Card>
    </div>
  );
}

function UsersSection({
  users,
  meId,
  onEditCredits,
  onDisable,
  onEnable,
  onDelete,
  onResetPassword,
  onSetRole,
}: {
  users: AdminUserRow[];
  meId: string | null;
  onEditCredits: (user: AdminUserRow) => void;
  onDisable: (user: AdminUserRow) => void;
  onEnable: (user: AdminUserRow) => void;
  onDelete: (user: AdminUserRow) => void;
  onResetPassword: (user: AdminUserRow) => void;
  onSetRole: (user: AdminUserRow, isAdmin: boolean) => void;
}) {
  return (
    <section>
      <SectionTitle title="用户管理" description="支持停用、启用、删除、重置密码、修改积分和管理员权限。" />
      <div className="mt-4">
        <Table>
          <THead>
            <TR><TH>手机号</TH><TH>状态</TH><TH>关系状态</TH><TH>积分</TH><TH>当前女友</TH><TH>消息数</TH><TH>操作</TH></TR>
          </THead>
          <TBody>
            {users.slice(0, 16).map((user) => (
              <TR key={user.id}>
                <TD className="font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span>{user.phone}</span>
                    {user.isAdmin ? <Badge tone="success">管理员</Badge> : null}
                  </div>
                </TD>
                <TD><UserStatusBadge status={user.status} /></TD>
                <TD>
                  <div className="space-y-1">
                    <Badge tone={user.relationshipStatus === "active" ? "success" : user.relationshipStatus === "cooldown" ? "warning" : "neutral"}>
                      {relationshipLabel[user.relationshipStatus]}
                    </Badge>
                    {user.cooldownEndsAt ? <p className="text-2xs text-text-subtle">至 {new Date(user.cooldownEndsAt).toLocaleTimeString("zh-CN")}</p> : null}
                  </div>
                </TD>
                <TD className="font-semibold tabular-nums">{user.credits}</TD>
                <TD>{user.activePersonaName ?? "-"}</TD>
                <TD>{user.totalMessages}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1.5">
                    <Button variant="secondary" size="sm" onClick={() => onEditCredits(user)}>积分</Button>
                    <Button variant="secondary" size="sm" onClick={() => onResetPassword(user)}>重置密码</Button>
                    {user.id !== meId ? (
                      user.isAdmin ? (
                        <Button variant="secondary" size="sm" onClick={() => onSetRole(user, false)}>取消管理员</Button>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => onSetRole(user, true)} disabled={user.status !== "active"}>提升管理员</Button>
                      )
                    ) : null}
                    {user.status === "active" ? (
                      <Button variant="destructive" size="sm" onClick={() => onDisable(user)} disabled={user.id === meId}>
                        <Ban className="h-3.5 w-3.5" />停用
                      </Button>
                    ) : user.status === "disabled" ? (
                      <Button variant="secondary" size="sm" onClick={() => onEnable(user)}>启用</Button>
                    ) : null}
                    <Button variant="destructive" size="sm" onClick={() => onDelete(user)} disabled={user.status === "deleted" || user.id === meId}>
                      <Trash2 className="h-3.5 w-3.5" />删除
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </section>
  );
}

function CreditsSection({
  users,
  settings,
  onEditCredits,
}: {
  users: AdminUserRow[];
  settings: AdminProviderSettings | null;
  onEditCredits: (user: AdminUserRow) => void;
}) {
  return (
    <section className="space-y-5">
      <SectionTitle title="积分管理" description="注册送 100 积分；对话一次消耗 1 积分，女友文字 1 积分，女友语音 2 积分，图片 5 积分，表情包不消耗积分。" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Stat label="注册送" value={settings?.credits.initialBalance ?? 100} />
        <Stat label="对话一次" value={settings?.credits.dialogueTurnCost ?? 1} />
        <Stat label="女友文字" value={settings?.credits.textMessageCost ?? 1} />
        <Stat label="女友语音" value={settings?.credits.voiceMessageCost ?? 2} />
        <Stat label="图片消息" value={settings?.credits.imageMessageCost ?? 5} />
        <Stat label="表情包" value={settings?.credits.stickerMessageCost ?? 0} />
      </div>
      <Table>
        <THead>
          <TR><TH>用户</TH><TH>积分余额</TH><TH>关系状态</TH><TH>总消息</TH><TH>操作</TH></TR>
        </THead>
        <TBody>
          {users.slice(0, 14).map((user) => (
            <TR key={user.id}>
              <TD className="font-mono text-xs">{user.phone}</TD>
              <TD className="font-semibold tabular-nums">{user.credits}</TD>
              <TD>{relationshipLabel[user.relationshipStatus]}</TD>
              <TD>{user.totalMessages}</TD>
              <TD><Button variant="secondary" size="sm" onClick={() => onEditCredits(user)}>修改积分</Button></TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </section>
  );
}

function PersonasSection({ personas }: { personas: { id: string; userPhone: string; nickname: string; status: PersonaStatus; archetype: string; sessionCount: number; trust: number; stress: number; affection: number }[] }) {
  return (
    <section>
      <SectionTitle title="女友列表" description="状态标签已中文化。好感度只用于后台/调试，不显示在用户聊天界面。" />
      <div className="mt-4">
        <Table>
          <THead>
            <TR><TH>昵称</TH><TH>用户</TH><TH>状态</TH><TH>类型</TH><TH>会话</TH><TH>信任</TH><TH>压力</TH><TH>好感</TH></TR>
          </THead>
          <TBody>
            {personas.slice(0, 16).map((persona) => (
              <TR key={persona.id}>
                <TD className="font-medium">{persona.nickname}</TD>
                <TD className="font-mono text-xs">{persona.userPhone}</TD>
                <TD><PersonaStatusBadge status={persona.status} /></TD>
                <TD>{persona.archetype}</TD>
                <TD>{persona.sessionCount}</TD>
                <TD>{persona.trust}</TD>
                <TD>{persona.stress}</TD>
                <TD>{persona.affection}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </section>
  );
}

function ChatsSection({ chats, onOpen }: { chats: AdminChatRecord[]; onOpen: (chat: AdminChatRecord) => void }) {
  return (
    <section>
      <SectionTitle title="聊天记录" description="查看用户与所有女友的聊天记录，包括当前关系和已分手关系。" />
      <div className="mt-4">
        <Table>
          <THead>
            <TR><TH>用户</TH><TH>女友</TH><TH>状态</TH><TH>消息数</TH><TH>消耗积分</TH><TH>最后消息</TH><TH>操作</TH></TR>
          </THead>
          <TBody>
            {chats.map((chat) => (
              <TR key={chat.id}>
                <TD className="font-mono text-xs">{chat.userPhone}</TD>
                <TD className="font-medium">{chat.personaName}</TD>
                <TD><PersonaStatusBadge status={chat.personaStatus} /></TD>
                <TD>{chat.messageCount}</TD>
                <TD>{chat.creditsSpent}</TD>
                <TD className="max-w-[280px] truncate">{chat.lastMessagePreview}</TD>
                <TD>
                  <Button variant="secondary" size="sm" onClick={() => onOpen(chat)}>
                    <Eye className="h-3.5 w-3.5" />查看聊天
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </section>
  );
}

function SettingsSection({
  draft,
  saved,
  onChange,
  onSave,
}: {
  draft: AdminProviderSettings | null;
  saved: boolean;
  onChange: (settings: AdminProviderSettings) => void;
  onSave: () => void;
}) {
  if (!draft) return <p className="text-sm text-text-muted">加载配置中</p>;

  return (
    <section className="space-y-5">
      <SectionTitle
        title="系统配置"
        description="配置运行时会读取的模型、接口地址、密钥、媒体存储和积分规则。"
        action={<Button onClick={onSave}><Save className="h-4 w-4" />保存配置</Button>}
      />
      {saved ? <p className="rounded-md bg-success/5 px-3 py-2 text-sm text-success">配置已保存</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <EditableCard title="LLM">
          <SettingInput label="Base URL" value={draft.llm.baseUrl} onChange={(value) => onChange({ ...draft, llm: { ...draft.llm, baseUrl: value } })} />
          <SettingInput label="Model" value={draft.llm.model} onChange={(value) => onChange({ ...draft, llm: { ...draft.llm, model: value } })} />
          <SettingInput label="API Key" value={draft.llm.apiKeyMasked} onChange={(value) => onChange({ ...draft, llm: { ...draft.llm, apiKeyMasked: value } })} />
          <TestProviderRow label="测试 LLM" hint="使用当前保存的 Base URL、Model 和 API Key 发送一句问候验证联通性。" runner={(input) => testAdminLlm(input)} placeholder="可选：测试 prompt" />
        </EditableCard>
        <EditableCard title="TTS">
          <SettingInput label="API Key" value={draft.tts.apiKeyMasked} onChange={(value) => onChange({ ...draft, tts: { ...draft.tts, apiKeyMasked: value } })} />
          <ToggleRow label="启用语音回复" enabled={draft.tts.enabled} onToggle={() => onChange({ ...draft, tts: { ...draft.tts, enabled: !draft.tts.enabled } })} />
          <TestProviderRow label="测试 TTS" hint="Provider、Base URL、Model 和格式使用代码默认值。" runner={(input) => testAdminTts(input)} placeholder="可选：要合成的文本" />
        </EditableCard>
        <EditableCard title="Image">
          <SettingInput label="Base URL" value={draft.image.baseUrl} onChange={(value) => onChange({ ...draft, image: { ...draft.image, baseUrl: value } })} />
          <SettingInput label="Model" value={draft.image.model} onChange={(value) => onChange({ ...draft, image: { ...draft.image, model: value } })} />
          <SettingInput label="API Key" value={draft.image.apiKeyMasked} onChange={(value) => onChange({ ...draft, image: { ...draft.image, apiKeyMasked: value } })} />
          <ToggleRow label="启用图片生成" enabled={draft.image.enabled} onToggle={() => onChange({ ...draft, image: { ...draft.image, enabled: !draft.image.enabled } })} />
          <TestProviderRow label="测试 Image" hint="使用当前保存的 Base URL、Model 和 API Key 生成一张连通性测试图。" runner={(input) => testAdminImage(input)} placeholder="可选：图片 prompt（英文）" />
        </EditableCard>
        <EditableCard title="媒体存储">
          <SettingInput label="媒体文件目录" value={draft.runtime.mediaDir} onChange={(value) => onChange({ ...draft, runtime: { ...draft.runtime, mediaDir: value } })} />
        </EditableCard>
        <EditableCard title="积分规则">
          <SettingInput label="注册送积分" type="number" value={String(draft.credits.initialBalance)} onChange={(value) => onChange({ ...draft, credits: { ...draft.credits, initialBalance: Number(value) } })} />
          <SettingInput label="对话一次消耗" type="number" value={String(draft.credits.dialogueTurnCost)} onChange={(value) => onChange({ ...draft, credits: { ...draft.credits, dialogueTurnCost: Number(value) } })} />
          <SettingInput label="女友文字消息消耗" type="number" value={String(draft.credits.textMessageCost)} onChange={(value) => onChange({ ...draft, credits: { ...draft.credits, textMessageCost: Number(value) } })} />
          <SettingInput label="女友语音消息消耗" type="number" value={String(draft.credits.voiceMessageCost)} onChange={(value) => onChange({ ...draft, credits: { ...draft.credits, voiceMessageCost: Number(value) } })} />
          <SettingInput label="图片消息消耗" type="number" value={String(draft.credits.imageMessageCost)} onChange={(value) => onChange({ ...draft, credits: { ...draft.credits, imageMessageCost: Number(value) } })} />
          <SettingInput label="表情包消耗" type="number" value={String(draft.credits.stickerMessageCost)} onChange={(value) => onChange({ ...draft, credits: { ...draft.credits, stickerMessageCost: Number(value) } })} />
          <SettingInput label="每日创建上限" type="number" value={String(draft.relationship.dailyCreationLimit)} onChange={(value) => onChange({ ...draft, relationship: { ...draft.relationship, dailyCreationLimit: Number(value) } })} />
        </EditableCard>
      </div>
    </section>
  );
}

function CreditDialog({
  user,
  value,
  onValueChange,
  onOpenChange,
  onSave,
}: {
  user: AdminUserRow | null;
  value: string;
  onValueChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent title="修改用户积分">
        <div className="mt-4 space-y-4">
          <p className="text-sm text-text-muted">用户：{user?.phone}</p>
          <div className="space-y-2">
            <Label htmlFor="credits">积分余额</Label>
            <Input id="credits" type="number" min={0} value={value} onChange={(event) => onValueChange(event.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>取消</Button>
            <Button onClick={onSave}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ result, onOpenChange }: { result: { phone: string; password: string } | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={Boolean(result)} onOpenChange={onOpenChange}>
      <DialogContent title="密码已重置">
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-6 text-text-muted">用户 {result?.phone} 的临时密码已生成。真实后端应强制用户下次登录修改密码。</p>
          <div className="rounded-md bg-bg-muted px-3 py-2 font-mono text-sm text-text">{result?.password}</div>
          <div className="flex justify-end"><Button onClick={() => onOpenChange(false)}>知道了</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChatDetailSheet({ chat, onOpenChange }: { chat: AdminChatRecord | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={Boolean(chat)} onOpenChange={onOpenChange}>
      <SheetContent title="聊天记录详情" className="md:w-[520px]">
        {chat ? (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="space-y-2 text-sm">
                <Row label="用户" value={chat.userPhone} />
                <Row label="女友" value={chat.personaName} />
                <Row label="状态" value={personaStatusLabel[chat.personaStatus]} />
                <Row label="消息数" value={String(chat.messageCount)} />
                <Row label="消耗积分" value={String(chat.creditsSpent)} />
              </div>
            </Card>
            <div className="rounded-xl border border-border bg-bg-subtle py-4">
              <div className="space-y-1">
                {chat.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Nav({ active, icon, text, onClick }: { active: boolean; icon: React.ReactNode; text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors ${active ? "bg-bg-muted text-text" : "text-text-muted hover:bg-bg-muted"}`}
    >
      {icon}{text}
    </button>
  );
}

function MobileNav({ active, text, onClick }: { active: boolean; text: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`h-9 rounded-md text-sm ${active ? "bg-text text-bg" : "bg-bg-muted text-text-muted"}`}>{text}</button>;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-text-subtle">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-text tabular-nums">
        {typeof value === "number" ? value.toLocaleString("zh-CN") : value}
      </p>
    </Card>
  );
}

function UserStatusBadge({ status }: { status: AdminUserRow["status"] }) {
  return <Badge tone={status === "active" ? "success" : status === "disabled" ? "warning" : "danger"}>{userStatusLabel[status]}</Badge>;
}

function PersonaStatusBadge({ status }: { status: PersonaStatus }) {
  return <Badge tone={status === "active" ? "success" : status === "broken_up" || status === "reconciliation_pending" ? "warning" : "neutral"}>{personaStatusLabel[status]}</Badge>;
}

function EditableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card className="space-y-4 p-4"><h3 className="text-sm font-semibold text-text">{title}</h3>{children}</Card>;
}

function SettingInput({ label, value, onChange, type = "text", disabled }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function ToggleRow({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-bg px-3 py-2">
      <span className="text-sm text-text-muted">{label}</span>
      <Button variant={enabled ? "primary" : "secondary"} size="sm" onClick={onToggle}>{enabled ? "开启" : "关闭"}</Button>
    </div>
  );
}

function TestProviderRow({
  label,
  hint,
  placeholder,
  runner,
}: {
  label: string;
  hint: string;
  placeholder?: string;
  runner: (input: string | undefined) => Promise<AdminTestResult>;
}) {
  const [value, setValue] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<AdminTestResult | null>(null);

  async function run() {
    setPending(true);
    setResult(null);
    try {
      const next = await runner(value.trim() || undefined);
      setResult(next);
    } catch (error) {
      setResult({ ok: false, status: "error", message: error instanceof Error ? error.message : "测试失败" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-bg px-3 py-3">
      <p className="text-xs text-text-subtle">{hint}</p>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          disabled={pending}
        />
        <Button variant="secondary" size="sm" onClick={run} disabled={pending}>
          <PlayCircle className="h-3.5 w-3.5" />
          {pending ? "测试中" : label}
        </Button>
      </div>
      {result ? <TestResultPreview result={result} /> : null}
    </div>
  );
}

function TestResultPreview({ result }: { result: AdminTestResult }) {
  const tone =
    result.status === "ok" ? "text-success"
    : result.status === "fallback" ? "text-warning"
    : result.status === "unconfigured" ? "text-text-muted"
    : "text-danger";
  return (
    <div className={`space-y-2 rounded-md bg-bg-muted px-3 py-2 text-2xs ${tone}`}>
      <p>
        状态：{result.status}
        {typeof result.durationMs === "number" ? `　耗时：${result.durationMs}ms` : ""}
        {result.message ? `　${result.message}` : ""}
      </p>
      {result.text ? <pre className="whitespace-pre-wrap text-text">{result.text}</pre> : null}
      {result.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={result.imageUrl} alt="测试图片" className="max-h-40 rounded-md border border-border" />
      ) : null}
      {result.stickerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={result.stickerUrl} alt="测试表情包" className="max-h-28 rounded-md border border-border" />
      ) : null}
      {result.audioDataUrl ? (
        <audio controls src={result.audioDataUrl} className="w-full" />
      ) : null}
      {result.detail ? <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-text">{result.detail}</pre> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-text-subtle">{label}</span>
      <span className="text-right text-text-muted">{value}</span>
    </div>
  );
}
