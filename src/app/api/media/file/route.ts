import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { getProviderSettings } from "@/lib/cyberpersona/provider-settings";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const contentTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
};

function resolveMediaRoot(mediaDir?: string) {
  return path.resolve(process.cwd(), mediaDir?.trim() || ".cyberpersona-media");
}

async function mediaRoot() {
  const settings = await getProviderSettings();
  return resolveMediaRoot(settings.runtime.mediaDir);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = url.searchParams.get("name");
  if (!name || name.includes("/") || name.includes("\\")) {
    return NextResponse.json({ ok: false, message: "非法媒体文件名" }, { status: 400 });
  }

  const root = await mediaRoot();
  const filePath = path.join(root, name);
  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    return NextResponse.json({ ok: false, message: "媒体文件不存在" }, { status: 404 });
  }

  const ext = path.extname(name).toLowerCase();
  const stream = createReadStream(filePath) as unknown as BodyInit;
  return new Response(stream, {
    headers: {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
