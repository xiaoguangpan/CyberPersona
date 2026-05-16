import { NextResponse } from "next/server";
import { getAdminPersonas } from "@/lib/cyberpersona/app-store";
import { withAdminGuard } from "@/lib/cyberpersona/api-guard";

export const runtime = "nodejs";

export async function GET() {
  return withAdminGuard(async () => NextResponse.json({ ok: true, personas: await getAdminPersonas() }));
}
