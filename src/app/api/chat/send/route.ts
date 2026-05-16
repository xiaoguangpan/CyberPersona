import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/cyberpersona/api-auth";
import { sendUserMessage } from "@/lib/cyberpersona/app-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const input = await request.json();
    const origin = new URL(request.url).origin;
    const result = await sendUserMessage(user.id, input, origin);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "发送失败";
    const status = message === "UNAUTHENTICATED" ? 401 : message.includes("积分不足") ? 402 : 400;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
