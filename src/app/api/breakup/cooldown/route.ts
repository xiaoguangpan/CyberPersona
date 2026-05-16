import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/cyberpersona/api-auth";
import { getBreakupCooldown } from "@/lib/cyberpersona/app-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const cooldown = await getBreakupCooldown(user.id);
    return NextResponse.json({ ok: true, cooldown });
  } catch {
    return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
  }
}
