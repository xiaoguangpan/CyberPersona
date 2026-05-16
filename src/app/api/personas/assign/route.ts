import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/cyberpersona/api-auth";
import { assignPersona } from "@/lib/cyberpersona/app-store";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await requireCurrentUser();
    const bundle = await assignPersona(user.id);
    return NextResponse.json({ ok: true, ...bundle });
  } catch (error) {
    const message = error instanceof Error ? error.message : "初始化新女友失败";
    const status = message === "UNAUTHENTICATED" ? 401 : 400;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
