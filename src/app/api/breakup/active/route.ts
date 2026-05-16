import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/cyberpersona/api-auth";
import { breakupActivePersona } from "@/lib/cyberpersona/app-store";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await requireCurrentUser();
    const result = await breakupActivePersona(user.id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "分手失败";
    return NextResponse.json({ ok: false, message }, { status: message === "UNAUTHENTICATED" ? 401 : 400 });
  }
}
