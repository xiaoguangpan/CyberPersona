"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartCrack, Image as ImageIcon, MessagesSquare } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import {
  assignNewPersona,
  breakupActivePersona,
  fetchActiveMessages,
  fetchActivePersona,
  fetchBreakupCooldown,
  fetchBrokenUpPersonas,
  sendUserMessage,
} from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingDots } from "@/components/ui/loading";
import { ChatHeader } from "./chat-header";
import { ChatInput } from "./chat-input";
import { MessageBubble } from "./message-bubble";
import { CharacterCardSheet } from "./character-card-sheet";
import { BreakupDialog } from "./breakup-dialog";
import { AssignmentScreen } from "./assignment-screen";
import { CooldownOverlay } from "./cooldown-overlay";

export function ChatScreen() {
  const queryClient = useQueryClient();
  const [assigning, setAssigning] = React.useState(false);
  const [cardOpen, setCardOpen] = React.useState(false);
  const [breakupOpen, setBreakupOpen] = React.useState(false);
  const [cooldown, setCooldown] = React.useState<{
    cooldownUntil: string;
    breakupCountToday: number;
    lastBrokenPersonaId?: string;
  } | null>(null);
  const [localMessages, setLocalMessages] = React.useState<ChatMessage[]>([]);

  const personaQuery = useQuery({ queryKey: ["activePersona"], queryFn: fetchActivePersona });
  const messageQuery = useQuery({ queryKey: ["activeMessages"], queryFn: fetchActiveMessages });
  const cooldownQuery = useQuery({ queryKey: ["breakupCooldown"], queryFn: fetchBreakupCooldown });
  const brokenQuery = useQuery({ queryKey: ["brokenPersonas"], queryFn: fetchBrokenUpPersonas });
  const autoAssignedRef = React.useRef(false);

  React.useEffect(() => {
    if (messageQuery.data) setLocalMessages(messageQuery.data);
  }, [messageQuery.data]);

  React.useEffect(() => {
    if (personaQuery.data && messageQuery.data?.length === 0) {
      void messageQuery.refetch();
    }
  }, [messageQuery, personaQuery.data]);

  React.useEffect(() => {
    if (cooldownQuery.data) setCooldown(cooldownQuery.data);
  }, [cooldownQuery.data]);

  const assignMutation = useMutation({
    mutationFn: assignNewPersona,
    onMutate: () => setAssigning(true),
    onSuccess: async () => {
      setCooldown(null);
      await queryClient.invalidateQueries({ queryKey: ["activePersona"] });
      await queryClient.invalidateQueries({ queryKey: ["activeMessages"] });
      await queryClient.invalidateQueries({ queryKey: ["brokenPersonas"] });
    },
    onSettled: () => setAssigning(false),
  });

  // Auto-assign on first visit: brand new account with no active persona,
  // no cooldown and no broken-up history.
  React.useEffect(() => {
    if (autoAssignedRef.current) return;
    if (personaQuery.isLoading || cooldownQuery.isLoading || brokenQuery.isLoading) return;
    if (personaQuery.data) return;
    if (cooldownQuery.data) return;
    if ((brokenQuery.data ?? []).length > 0) return;
    autoAssignedRef.current = true;
    assignMutation.mutate();
  }, [
    personaQuery.data,
    personaQuery.isLoading,
    cooldownQuery.data,
    cooldownQuery.isLoading,
    brokenQuery.data,
    brokenQuery.isLoading,
    assignMutation,
  ]);

  const createClientRequestId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  };

  const sendMutation = useMutation({
    mutationFn: sendUserMessage,
    onMutate: async (input) => {
      const clientRequestId = input.clientRequestId ?? createClientRequestId();
      const optimistic: ChatMessage = {
        id: `optimistic_${clientRequestId}`,
        personaId: personaQuery.data?.id ?? "p_active_01",
        role: "user",
        type: input.type ?? "text",
        text: input.text,
        stickerKeyword: input.stickerKeyword,
        stickerEmoji: input.stickerEmoji,
        clientRequestId,
        createdAt: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, optimistic]);
    },
    onSuccess: (result, input) => {
      setLocalMessages((prev) => {
        const clientRequestId = result.user.clientRequestId ?? input.clientRequestId;
        const withoutOptimistic = prev.filter((msg) => {
          if (!msg.id.startsWith("optimistic_")) return true;
          return clientRequestId ? msg.clientRequestId !== clientRequestId : false;
        });
        return [...withoutOptimistic, result.user, ...result.assistant];
      });
      void queryClient.invalidateQueries({ queryKey: ["activePersona"] });
    },
  });

  const breakupMutation = useMutation({
    mutationFn: breakupActivePersona,
    onSuccess: (result) => {
      setBreakupOpen(false);
      setCooldown({
        cooldownUntil: result.cooldownUntil,
        breakupCountToday: result.breakupCountToday,
        lastBrokenPersonaId: result.lastBrokenPersonaId,
      });
      void queryClient.invalidateQueries({ queryKey: ["activePersona"] });
      void queryClient.invalidateQueries({ queryKey: ["brokenPersonas"] });
    },
  });

  if (assigning || assignMutation.isPending) return <AssignmentScreen />;
  if (personaQuery.isLoading || messageQuery.isLoading || brokenQuery.isLoading || cooldownQuery.isLoading) return <AssignmentScreen />;

  const persona = personaQuery.data;
  const willAutoAssign =
    !persona && !cooldownQuery.data && (brokenQuery.data ?? []).length === 0 && !autoAssignedRef.current;
  if (willAutoAssign) return <AssignmentScreen />;

  if (!persona) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4">
        <Card className="max-w-sm p-6 text-center">
          <h1 className="text-xl font-semibold text-text">还没有当前女友</h1>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            默认登录会自动分配。只有刚分手、冷静期结束后等待重新分配，或数据异常时才会出现这个状态。
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Button onClick={() => assignMutation.mutate()}>分配新女友</Button>
            <Button asChild variant="secondary">
              <Link href="/me">查看历史关系</Link>
            </Button>
          </div>
        </Card>
        {cooldown ? (
          <CooldownOverlay
            cooldownUntil={cooldown.cooldownUntil}
            breakupCountToday={cooldown.breakupCountToday}
            lastBrokenPersonaId={cooldown.lastBrokenPersonaId}
            onComplete={() => {
              window.localStorage.removeItem("cyberpersona_breakup_cooldown");
              setCooldown(null);
              assignMutation.mutate();
            }}
          />
        ) : null}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg">
      <ChatHeader persona={persona} onOpenCard={() => setCardOpen(true)} />
      <div className="mx-auto grid max-w-[1120px] grid-cols-1 md:grid-cols-[1fr_300px]">
        <section className="flex min-h-[calc(100vh-3.5rem)] flex-col border-x border-border bg-bg-subtle/40 md:border-l">
          <div className="flex-1 space-y-1 py-5">
            <DateDivider label="今天 19:20" />
            {localMessages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {sendMutation.isPending ? <TypingIndicator /> : null}
          </div>
          <ChatInput
            onSend={(text) => sendMutation.mutate({ text, clientRequestId: createClientRequestId() })}
            onSendSticker={(sticker) => sendMutation.mutate({
              text: `${sticker.emoji} ${sticker.keyword}`,
              type: "sticker",
              stickerEmoji: sticker.emoji,
              stickerKeyword: sticker.keyword,
              clientRequestId: createClientRequestId(),
            })}
            disabled={sendMutation.isPending}
          />
        </section>

        <aside className="hidden border-r border-border bg-bg px-4 py-5 md:block">
          <div className="space-y-4">
            <Card className="p-4">
              <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.08em] text-text-subtle">
                当前状态
              </p>
              <p className="text-sm leading-6 text-text-muted">{persona.currentEmotion}</p>
            </Card>
            <Card className="p-4">
              <p className="mb-3 text-sm font-medium text-text">快捷入口</p>
              <div className="space-y-2">
                <SideAction icon={<MessagesSquare className="h-4 w-4" />} text="查看角色卡" onClick={() => setCardOpen(true)} />
                <SideAction icon={<ImageIcon className="h-4 w-4" />} text="打开相册" href={`/album/${persona.id}`} />
                <SideAction icon={<HeartCrack className="h-4 w-4" />} text="分手" onClick={() => setBreakupOpen(true)} danger />
              </div>
            </Card>
          </div>
        </aside>
      </div>

      <CharacterCardSheet persona={persona} open={cardOpen} onOpenChange={setCardOpen} />
      <BreakupDialog
        open={breakupOpen}
        onOpenChange={setBreakupOpen}
        onConfirm={() => breakupMutation.mutate()}
      />
      {cooldown ? (
        <CooldownOverlay
          cooldownUntil={cooldown.cooldownUntil}
          breakupCountToday={cooldown.breakupCountToday}
          lastBrokenPersonaId={cooldown.lastBrokenPersonaId}
          onComplete={() => {
            window.localStorage.removeItem("cyberpersona_breakup_cooldown");
            setCooldown(null);
            assignMutation.mutate();
          }}
        />
      ) : null}
    </main>
  );
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="my-4 flex justify-center">
      <span className="text-2xs text-text-subtle">{label}</span>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex px-4">
      <div className="rounded-2xl rounded-bl-md bg-bubble-in px-4 py-3 text-text-muted">
        <LoadingDots />
      </div>
    </div>
  );
}

function SideAction({
  icon,
  text,
  onClick,
  href,
  danger,
}: {
  icon: React.ReactNode;
  text: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}) {
  const className = `flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-bg-muted ${danger ? "text-danger" : "text-text-muted"}`;
  if (href) {
    return (
      <a href={href} className={className}>
        {icon}
        {text}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {icon}
      {text}
    </button>
  );
}
