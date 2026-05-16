import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/cyberpersona/api-auth";
import { getPersonaForUser } from "@/lib/cyberpersona/app-store";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    const persona = await getPersonaForUser(user.id, params.id);
    return NextResponse.json({ ok: true, persona });
  } catch {
    return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
  }
}
