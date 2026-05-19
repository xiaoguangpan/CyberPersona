import { NextResponse } from "next/server";
import { generateConsistentPersonaImage } from "@/lib/cyberpersona/server";

export const runtime = "nodejs";

type ImageRequestBody = {
  prompt?: string;
  referencePhotoUrl?: string;
  referencePhotoPath?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ImageRequestBody | null;
  const prompt = body?.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ ok: false, message: "缺少图片 prompt" }, { status: 400 });
  }

  const result = await generateConsistentPersonaImage({
    prompt,
    referencePhotoUrl: body?.referencePhotoUrl,
    referencePhotoPath: body?.referencePhotoPath,
    source: "chat-image",
  });

  if (result.fallback) {
    return NextResponse.json({
      ok: false,
      status: "fallback",
      imageUrl: result.url,
      imagePath: result.path,
      message: result.fallbackReason || "图片接口未配置或返回失败",
    }, { status: 502 });
  }

  return NextResponse.json({ ok: true, status: "ok", imageUrl: result.url, imagePath: result.path });
}
