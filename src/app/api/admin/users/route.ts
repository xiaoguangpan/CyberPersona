import { NextResponse } from "next/server";
import { getAdminUsers } from "@/lib/cyberpersona/app-store";
import { withAdminGuard } from "@/lib/cyberpersona/api-guard";

export const runtime = "nodejs";

export async function GET() {
  return withAdminGuard(async () => NextResponse.json({ ok: true, users: await getAdminUsers() }));
}
