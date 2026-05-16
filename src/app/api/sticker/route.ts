import { NextResponse } from "next/server";
import { searchSticker } from "@/lib/cyberpersona/server";

export const runtime = "nodejs";

type StickerRequestBody = {
  keyword?: string;
};

function fallbackSticker(keyword: string) {
  const safe = keyword.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] ?? char));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="48" fill="#fff7ed"/><circle cx="128" cy="106" r="58" fill="#fed7aa"/><circle cx="106" cy="95" r="8" fill="#292524"/><circle cx="150" cy="95" r="8" fill="#292524"/><path d="M100 128c16 18 40 18 56 0" stroke="#292524" stroke-width="8" stroke-linecap="round" fill="none"/><text x="128" y="212" text-anchor="middle" font-size="28" font-family="sans-serif" fill="#7c2d12">${safe}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as StickerRequestBody | null;
  const keyword = body?.keyword?.trim();
  if (!keyword) {
    return NextResponse.json({ ok: false, message: "缺少表情包关键词" }, { status: 400 });
  }

  try {
    const result = await searchSticker(keyword);
    return NextResponse.json({ ok: true, stickerUrl: result.url, sourceUrl: result.sourceUrl, fallback: false });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      stickerUrl: fallbackSticker(keyword),
      fallback: true,
      message: error instanceof Error ? error.message : "表情包服务不可用，已使用本地兜底",
    });
  }
}
