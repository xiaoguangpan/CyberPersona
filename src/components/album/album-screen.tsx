"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { fetchAlbumByPersona, fetchPersonaById } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";

export function AlbumScreen({ personaId }: { personaId: string }) {
  const persona = useQuery({ queryKey: ["persona", personaId], queryFn: () => fetchPersonaById(personaId) });
  const album = useQuery({ queryKey: ["album", personaId], queryFn: () => fetchAlbumByPersona(personaId) });

  return (
    <main className="min-h-screen bg-bg-subtle">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[980px] items-center gap-3 px-4">
          <Button asChild variant="ghost" size="icon-sm">
            <Link href={persona.data?.status === "broken_up" ? `/me/personas/${personaId}` : "/"}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-sm font-semibold text-text">相册</h1>
        </div>
      </header>

      <div className="mx-auto max-w-[980px] px-4 py-6">
        <SectionTitle
          title={persona.data ? `${persona.data.nickname} 的相册` : "相册"}
          description="所有由角色自然发送或生成的图片都会沉淀在这里。"
        />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {(album.data ?? []).map((item) => (
            <Card key={item.id} className="group overflow-hidden p-0">
              <button className="block w-full text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt={item.caption ?? "相册图片"} className="aspect-square w-full object-cover" />
                <div className="space-y-2 p-3">
                  <p className="line-clamp-2 text-sm text-text">{item.caption ?? "无标题"}</p>
                  <div className="flex items-center justify-between text-xs text-text-subtle">
                    <span>{new Date(item.createdAt).toLocaleDateString("zh-CN")}</span>
                    {item.relatedMessageId ? (
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />聊天
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
