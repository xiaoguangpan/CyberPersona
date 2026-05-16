import { NextResponse } from "next/server";
import { getProviderSettings } from "@/lib/cyberpersona/provider-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getProviderSettings();
  return NextResponse.json({
    ok: true,
    asrEnabled: Boolean(settings.asr.enabled && settings.asr.apiKey && settings.asr.baseUrl),
    llmAudioEnabled: Boolean(settings.llmAudio.enabled && settings.llmAudio.apiKey && settings.llmAudio.baseUrl),
  });
}
