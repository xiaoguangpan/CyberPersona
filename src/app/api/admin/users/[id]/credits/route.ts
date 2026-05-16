import { NextResponse } from "next/server";
import { updateUserCredits } from "@/lib/cyberpersona/app-store";
import { withAdminGuard } from "@/lib/cyberpersona/api-guard";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return withAdminGuard(async () => {
    try {
      const body = await request.json() as { credits?: number };
      if (!Number.isFinite(body.credits)) return NextResponse.json({ ok: false, message: "积分不合法" }, { status: 400 });
      await updateUserCredits(params.id, Number(body.credits));
      return NextResponse.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "更新积分失败";
      return NextResponse.json({ ok: false, message }, { status: 400 });
    }
  });
}
