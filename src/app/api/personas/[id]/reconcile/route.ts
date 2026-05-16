import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/cyberpersona/api-auth";
import { requestReconciliation } from "@/lib/cyberpersona/app-store";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireCurrentUser();
    const result = await requestReconciliation(user.id, params.id);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
  }
}
