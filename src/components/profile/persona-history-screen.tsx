"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Album, ArrowLeft, MessageCircle, RotateCcw } from "lucide-react";
import { fetchAlbumByPersona, fetchArchivedMessages, fetchPersonaById, reconcilePersona } from "@/lib/services";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { MessageBubble } from "@/components/chat/message-bubble";
import { CharacterCardSheet } from "@/components/chat/character-card-sheet";
import * as React from "react";

export function PersonaHistoryScreen({ personaId }: { personaId: string }) {
  const queryClient = useQueryClient();
  const [cardOpen, setCardOpen] = React.useState(false);
  const persona = useQuery({ queryKey: ["persona", personaId], queryFn: () => fetchPersonaById(personaId) });
  const messages = useQuery({ queryKey: ["archivedMessages", personaId], queryFn: () => fetchArchivedMessages(personaId) });
  const album = useQuery({ queryKey: ["album", personaId], queryFn: () => fetchAlbumByPersona(personaId) });
  const reconcile = useMutation({
    mutationFn: reconcilePersona,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["persona", personaId] });
      await queryClient.invalidateQueries({ queryKey: ["brokenPersonas"] });
    },
  });

  if (!persona.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-sm text-text-muted">加载中</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-subtle">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[920px] items-center gap-3 px-4">
          <Button asChild variant="ghost" size="icon-sm">
            <Link href="/me"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-sm font-semibold text-text">历史关系</h1>
        </div>
      </header>

      <div className="mx-auto grid max-w-[920px] grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setCardOpen(true)}>
                <Avatar src={persona.data.avatarUrl} name={persona.data.nickname} className="h-14 w-14" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-text">{persona.data.nickname}</h2>
                  <Badge tone={persona.data.status === "reconciliation_pending" ? "warning" : "neutral"}>
                    {persona.data.status === "reconciliation_pending" ? "待复合" : "已分手"}
                  </Badge>
                </div>
                <p className="text-sm text-text-muted">{persona.data.currentEmotion}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setCardOpen(true)}>角色卡</Button>
              <Button asChild variant="secondary">
                <Link href={`/album/${personaId}`}>相册</Link>
              </Button>
            </div>
            <Button
              className="mt-3 w-full"
              onClick={() => reconcile.mutate(personaId)}
              disabled={persona.data.status === "reconciliation_pending" || reconcile.isPending}
            >
              <RotateCcw className="h-4 w-4" />
              {persona.data.status === "reconciliation_pending" ? "等待回应" : "重新联系"}
            </Button>
            {reconcile.data ? (
              <p className="mt-3 rounded-md bg-bg-muted px-3 py-2 text-sm leading-6 text-text-muted">
                {reconcile.data.ok
                  ? "复合请求已提交，状态进入待复合。真实后端应让她基于关系状态、分手原因和最近记忆决定接受或拒绝。"
                  : reconcile.data.message}
              </p>
            ) : null}
          </Card>

          <Card className="p-4">
            <SectionTitle title="相册预览" />
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(album.data ?? []).slice(0, 6).map((item) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={item.id} src={item.imageUrl} alt={item.caption ?? "相册"} className="aspect-square rounded-lg object-cover" />
              ))}
            </div>
          </Card>
        </aside>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-text">
            <MessageCircle className="h-4 w-4" />
            聊天记录
          </div>
          <Card className="overflow-hidden py-4">
            <div className="space-y-1">
              {(messages.data ?? []).map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </div>
          </Card>
          <div className="flex items-center gap-2 text-sm text-text-subtle">
            <Album className="h-4 w-4" />
            分手后记录只读,不会出现在主聊天列表。
          </div>
        </section>
      </div>

      <CharacterCardSheet persona={persona.data} open={cardOpen} onOpenChange={setCardOpen} />
    </main>
  );
}
