import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/cyberpersona/api-auth";
import { getBrokenPersonas } from "@/lib/cyberpersona/app-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const personas = await getBrokenPersonas(user.id);
    return NextResponse.json({ ok: true, personas });
  } catch {
    return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
  }
}
