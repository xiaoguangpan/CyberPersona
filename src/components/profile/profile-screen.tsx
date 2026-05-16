"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Album, ArrowLeft, ChevronRight, LogOut, MessageCircle, UserRound } from "lucide-react";
import { fetchActivePersona, fetchBrokenUpPersonas, fetchCurrentUser, logout } from "@/lib/services";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { maskPhone } from "@/lib/utils";
import { ChangePasswordDialog } from "./change-password-dialog";

export function ProfileScreen() {
  const user = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser });
  const active = useQuery({ queryKey: ["activePersona"], queryFn: fetchActivePersona });
  const broken = useQuery({ queryKey: ["brokenPersonas"], queryFn: fetchBrokenUpPersonas });

  async function signOut() {
    await logout();
    window.location.href = "/";
  }

  return (
    <main className="min-h-screen bg-bg-subtle">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[860px] items-center gap-3 px-4">
          <Button asChild variant="ghost" size="icon-sm">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-sm font-semibold text-text">个人中心</h1>
        </div>
      </header>

      <div className="mx-auto max-w-[860px] space-y-6 px-4 py-6">
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-base font-semibold text-brand-fg">
              我
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold text-text">
                {user.data ? maskPhone(user.data.phone) : "加载中"}
              </p>
              <p className="text-sm text-text-muted">
                今日已分配 {user.data?.todayCreationCount ?? 0} / {user.data?.dailyCreationLimit ?? 3} 次
              </p>
            </div>
            <ChangePasswordDialog trigger={<Button variant="secondary" size="sm">修改密码</Button>} />
          </div>
        </Card>

        {active.data ? (
          <section className="space-y-3">
            <SectionTitle title="当前女友" description="主界面不会展示女友列表,这里只作为个人中心入口。" />
            <Card className="p-4">
              <Link href="/" className="flex items-center gap-3">
                <Avatar src={active.data.avatarUrl} name={active.data.nickname} className="h-12 w-12" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-text">{active.data.nickname}</p>
                    <Badge tone="success">当前</Badge>
                  </div>
                  <p className="truncate text-sm text-text-muted">{active.data.currentEmotion}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-text-subtle" />
              </Link>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Quick href="/" icon={<MessageCircle className="h-4 w-4" />} label="聊天" />
                <Quick href={`/album/${active.data.id}`} icon={<Album className="h-4 w-4" />} label="相册" />
                <Quick href="/" icon={<UserRound className="h-4 w-4" />} label="角色卡" />
              </div>
            </Card>
          </section>
        ) : null}

        <section className="space-y-3">
          <SectionTitle title="分手的女友" description="不会出现在主聊天列表里,只在个人中心保留入口。" />
          <div className="space-y-3">
            {(broken.data ?? []).map((persona) => (
              <Card key={persona.id} className="p-4">
                <Link href={`/me/personas/${persona.id}`} className="flex items-center gap-3">
                  <Avatar src={persona.avatarUrl} name={persona.nickname} className="h-12 w-12" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-text">{persona.nickname}</p>
                      <Badge tone={persona.status === "reconciliation_pending" ? "warning" : "neutral"}>
                        {persona.status === "reconciliation_pending" ? "待复合" : "已分手"}
                      </Badge>
                    </div>
                    <p className="truncate text-sm text-text-muted">{persona.currentEmotion}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-text-subtle" />
                </Link>
              </Card>
            ))}
          </div>
        </section>

        <Card className="p-4">
          <button className="flex w-full items-center gap-3 text-left text-danger" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            <span className="text-sm font-medium">退出登录</span>
          </button>
        </Card>
      </div>
    </main>
  );
}

function Quick({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-bg text-sm text-text-muted hover:bg-bg-muted"
    >
      {icon}
      {label}
    </Link>
  );
}
