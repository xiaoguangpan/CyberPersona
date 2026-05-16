import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/cyberpersona/api-auth";
import { getActivePersona } from "@/lib/cyberpersona/app-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const persona = await getActivePersona(user.id);
    return NextResponse.json({ ok: true, persona });
  } catch {
    return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
  }
}
