import { NextResponse } from "next/server";
import type { AdminProviderSettings } from "@/lib/types";
import { getProviderSettings, publicProviderSettings, saveProviderSettings } from "@/lib/cyberpersona/provider-settings";
import { withAdminGuard } from "@/lib/cyberpersona/api-guard";

export const runtime = "nodejs";

export async function GET() {
  return withAdminGuard(async () => {
    const settings = await getProviderSettings();
    return NextResponse.json({ ok: true, settings: publicProviderSettings(settings) });
  });
}

export async function PUT(request: Request) {
  return withAdminGuard(async () => {
    const body = (await request.json().catch(() => null)) as AdminProviderSettings | null;
    if (!body) {
      return NextResponse.json({ ok: false, message: "缺少配置内容" }, { status: 400 });
    }
    const settings = await saveProviderSettings(body);
    return NextResponse.json({ ok: true, settings });
  });
}
