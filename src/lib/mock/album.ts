import type { AlbumItem } from "../types";
import { ACTIVE_PERSONA, BROKEN_UP_PERSONAS } from "./persona";

export const ALBUM_BY_PERSONA: Record<string, AlbumItem[]> = {
  [ACTIVE_PERSONA.id]: [
    {
      id: "alb_active_01",
      personaId: ACTIVE_PERSONA.id,
      imageUrl: "https://picsum.photos/seed/linxi-photo/720/720",
      caption: "她说这是她最近写稿的窗子",
      createdAt: "2026-05-04T14:11:00.000Z",
    },
    {
      id: "alb_active_02",
      personaId: ACTIVE_PERSONA.id,
      imageUrl: "https://picsum.photos/seed/linxi-rain/720/720",
      caption: "下雨那天",
      createdAt: "2026-05-08T20:55:00.000Z",
    },
    {
      id: "alb_active_03",
      personaId: ACTIVE_PERSONA.id,
      imageUrl: "https://picsum.photos/seed/linxi-book/720/720",
      caption: "在校的稿子,只能看到边角",
      createdAt: "2026-05-11T16:32:00.000Z",
      relatedMessageId: "m_018",
    },
    {
      id: "alb_active_04",
      personaId: ACTIVE_PERSONA.id,
      imageUrl: "https://picsum.photos/seed/balcony-light/720/720",
      caption: "刚才阳台拍的,光打过来真好看。",
      createdAt: "2026-05-15T11:28:00.000Z",
      relatedMessageId: "m_020",
    },
  ],
  [BROKEN_UP_PERSONAS[0].id]: [
    {
      id: "alb_sunian_01",
      personaId: BROKEN_UP_PERSONAS[0].id,
      imageUrl: "https://picsum.photos/seed/sunian-room/720/720",
      caption: "她那间空旷的工作室",
      createdAt: "2026-03-20T10:00:00.000Z",
    },
    {
      id: "alb_sunian_02",
      personaId: BROKEN_UP_PERSONAS[0].id,
      imageUrl: "https://picsum.photos/seed/sunian-table/720/720",
      caption: "三杯清水排成一排",
      createdAt: "2026-04-02T19:14:00.000Z",
    },
  ],
  [BROKEN_UP_PERSONAS[1].id]: [
    {
      id: "alb_zhixia_01",
      personaId: BROKEN_UP_PERSONAS[1].id,
      imageUrl: "https://picsum.photos/seed/zhixia-leaves/720/720",
      caption: "她踩着的落叶",
      createdAt: "2026-02-08T15:20:00.000Z",
    },
    {
      id: "alb_zhixia_02",
      personaId: BROKEN_UP_PERSONAS[1].id,
      imageUrl: "https://picsum.photos/seed/zhixia-milk/720/720",
      caption: "她常喝的那家奶茶",
      createdAt: "2026-02-19T17:08:00.000Z",
    },
    {
      id: "alb_zhixia_03",
      personaId: BROKEN_UP_PERSONAS[1].id,
      imageUrl: "https://picsum.photos/seed/zhixia-night/720/720",
      caption: "夜里出门的一张",
      createdAt: "2026-02-27T22:35:00.000Z",
    },
  ],
};
