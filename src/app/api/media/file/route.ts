import { createReadStream, existsSync, statSync } from "node:fs";
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
  const size = statSync(filePath).size;
  const contentType = contentTypes[ext] || "application/octet-stream";
  const range = request.headers.get("range");

  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match) {
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${size}`,
          "Accept-Ranges": "bytes",
        },
      });
    }

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : size - 1;
    const safeEnd = Math.min(end, size - 1);

    if (!Number.isFinite(start) || !Number.isFinite(safeEnd) || start < 0 || start >= size || safeEnd < start) {
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${size}`,
          "Accept-Ranges": "bytes",
        },
      });
    }

    const stream = createReadStream(filePath, { start, end: safeEnd }) as unknown as BodyInit;
    return new Response(stream, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(safeEnd - start + 1),
        "Content-Range": `bytes ${start}-${safeEnd}/${size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  }

  const stream = createReadStream(filePath) as unknown as BodyInit;
  return new Response(stream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
