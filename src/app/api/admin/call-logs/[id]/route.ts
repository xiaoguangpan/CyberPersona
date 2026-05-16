import { NextResponse } from "next/server";
import { getCallById } from "@/lib/cyberpersona/call-logs";
import { withAdminGuard } from "@/lib/cyberpersona/api-guard";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withAdminGuard(async () => {
    const { id } = await context.params;
    const log = await getCallById(id);
    if (!log) return NextResponse.json({ ok: false, message: "未找到该调用记录" }, { status: 404 });
    return NextResponse.json({ ok: true, log });
  });
}
