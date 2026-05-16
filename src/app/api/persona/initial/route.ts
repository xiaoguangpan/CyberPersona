import { NextResponse } from "next/server";
import { createInitialPersonaBundle } from "@/lib/cyberpersona/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const bundle = await createInitialPersonaBundle();
    return NextResponse.json({ ok: true, ...bundle });
  } catch (error) {
    const message = error instanceof Error ? error.message : "初始化角色失败";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
