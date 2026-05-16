import { NextResponse } from "next/server";
import { getProviderSettings } from "@/lib/cyberpersona/provider-settings";

export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = await getProviderSettings();
    return NextResponse.json({
      ok: true,
      time: new Date().toISOString(),
      providers: {
        llm: Boolean(settings.llm.baseUrl && settings.llm.model),
        tts: settings.tts.enabled,
        image: settings.image.enabled,
        asr: settings.asr.enabled,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "health check failed" },
      { status: 500 },
    );
  }
}
