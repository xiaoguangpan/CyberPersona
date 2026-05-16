"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Album, Settings, UserRound } from "lucide-react";
import type { Persona } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { fetchCurrentUser } from "@/lib/services";

export function ChatHeader({
  persona,
  onOpenCard,
}: {
  persona: Persona;
  onOpenCard: () => void;
}) {
  const user = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser });
  return (
    <header className="safe-top sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/90">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4">
        <button
          type="button"
          onClick={onOpenCard}
          className="flex min-w-0 items-center gap-3 rounded-md pr-2 text-left transition-colors hover:bg-bg-muted"
        >
          <Avatar src={persona.avatarUrl} name={persona.nickname} className="h-9 w-9" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold text-text">{persona.nickname}</h1>
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
            </div>
            <p className="truncate text-xs text-text-muted">{persona.currentEmotion}</p>
          </div>
        </button>

        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" aria-label="相册">
            <Link href={`/album/${persona.id}`}>
              <Album className="h-4 w-4" />
            </Link>
          </Button>
          {user.data?.isAdmin ? (
            <Button asChild variant="ghost" size="icon" aria-label="后台">
              <Link href="/admin">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="icon" aria-label="个人中心">
            <Link href="/me">
              <UserRound className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
