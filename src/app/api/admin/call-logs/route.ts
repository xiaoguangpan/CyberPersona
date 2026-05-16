import { NextResponse } from "next/server";
import type { CallLogType } from "@/lib/types";
import { listCalls } from "@/lib/cyberpersona/call-logs";
import { withAdminGuard } from "@/lib/cyberpersona/api-guard";

export const runtime = "nodejs";

const allowedTypes: CallLogType[] = ["llm", "image", "sticker"];

export async function GET(request: Request) {
  return withAdminGuard(async () => {
    const url = new URL(request.url);
    const typeParam = (url.searchParams.get("type") || "llm") as CallLogType;
    const type = allowedTypes.includes(typeParam) ? typeParam : "llm";
    const limitParam = Number(url.searchParams.get("limit") || 50);
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(100, Math.floor(limitParam))) : 50;
    const logs = await listCalls(type, limit);
    return NextResponse.json({ ok: true, type, logs });
  });
}
