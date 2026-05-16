import { NextResponse } from "next/server";
import { resetUserPassword } from "@/lib/cyberpersona/app-store";
import { withAdminGuard } from "@/lib/cyberpersona/api-guard";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  return withAdminGuard(async () => {
    try {
      const temporaryPassword = await resetUserPassword(params.id);
      return NextResponse.json({ ok: true, temporaryPassword });
    } catch (error) {
      const message = error instanceof Error ? error.message : "重置密码失败";
      return NextResponse.json({ ok: false, message }, { status: 400 });
    }
  });
}
