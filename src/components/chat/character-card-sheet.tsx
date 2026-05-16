"use client";

import { BookOpen, Camera, Heart, Mic2, UserRound } from "lucide-react";
import type { Persona } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function CharacterCardSheet({
  persona,
  open,
  onOpenChange,
}: {
  persona: Persona;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const card = persona.characterCard;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="角色卡">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Avatar src={persona.avatarUrl} name={persona.nickname} className="h-14 w-14" />
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-text">
                {persona.nickname}
              </h2>
              <p className="text-sm text-text-muted">{persona.currentEmotion}</p>
            </div>
          </div>

          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-text">
              <UserRound className="h-4 w-4" />
              已确定身份
            </div>
            <FieldList
              items={{
                年龄: card.identity.age,
                家乡: card.identity.hometown,
                职业: card.identity.profession,
              }}
            />
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-text">
              <Camera className="h-4 w-4" />
              外貌锚点
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                card.appearance.hair,
                card.appearance.skin,
                card.appearance.eye,
                card.appearance.photoOutfit,
                card.appearance.bodyType,
              ]
                .filter(Boolean)
                .map((item) => (
                  <Badge key={item}>{item}</Badge>
                ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-text">
              <Mic2 className="h-4 w-4" />
              声音
            </div>
            <p className="text-sm text-text-muted">{card.voice.voiceStyle}</p>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-text">
              <Heart className="h-4 w-4" />
              已透露偏好
            </div>
            <div className="space-y-3 text-sm">
              <SimpleArray label="喜欢" value={card.preferences.likes} />
              <SimpleArray label="不喜欢" value={card.preferences.dislikes} />
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-text">
              <BookOpen className="h-4 w-4" />
              共同回忆
            </div>
            <ul className="space-y-2 text-sm text-text-muted">
              {[...card.memories.events, ...card.memories.milestones].map((item) => (
                <li key={item} className="rounded-md bg-bg-muted px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FieldList({ items }: { items: Record<string, string | undefined> }) {
  return (
    <dl className="space-y-2 text-sm">
      {Object.entries(items).map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4">
          <dt className="text-text-subtle">{label}</dt>
          <dd className="text-right text-text-muted">{value ?? "尚未自然透露"}</dd>
        </div>
      ))}
    </dl>
  );
}

function SimpleArray({ label, value }: { label: string; value: unknown }) {
  const arr = Array.isArray(value) ? value : [];
  return (
    <div>
      <p className="mb-2 text-text-subtle">{label}</p>
      {arr.length ? (
        <div className="flex flex-wrap gap-2">
          {arr.map((item) => (
            <Badge key={String(item)}>{String(item)}</Badge>
          ))}
        </div>
      ) : (
        <p className="text-text-subtle">尚未自然透露</p>
      )}
    </div>
  );
}
