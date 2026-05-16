"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Mic, Send, Smile, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchVoiceInputStatus, transcribeAudio } from "@/lib/services";

const emojiOptions = ["😊", "🥺", "😂", "😳", "😭", "😌", "❤️", "👍", "🌙", "☕"];
const stickerOptions = [
  { emoji: "🥺", keyword: "委屈" },
  { emoji: "😂", keyword: "笑出声" },
  { emoji: "😴", keyword: "困了" },
  { emoji: "❤️", keyword: "贴贴" },
];

type RecordingState = "idle" | "recording" | "transcribing";

export function ChatInput({
  onSend,
  onSendSticker,
  disabled,
}: {
  onSend: (text: string) => void;
  onSendSticker?: (sticker: { emoji: string; keyword: string }) => void;
  disabled?: boolean;
}) {
  const [text, setText] = React.useState("");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [recording, setRecording] = React.useState<RecordingState>("idle");
  const [recorderError, setRecorderError] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);

  const supported = typeof window !== "undefined"
    && typeof window.MediaRecorder !== "undefined"
    && Boolean(navigator.mediaDevices?.getUserMedia);

  // Only show the mic when the server actually has a way to handle audio
  // (ASR enabled, or a multimodal LLM-audio endpoint enabled). When neither
  // is on we hide the button instead of showing a noisy error to the user.
  const voiceStatus = useQuery({
    queryKey: ["voiceInputStatus"],
    queryFn: fetchVoiceInputStatus,
    staleTime: 60_000,
  });
  const voiceInputEnabled = Boolean(voiceStatus.data?.asrEnabled || voiceStatus.data?.llmAudioEnabled);
  const showMic = supported && voiceInputEnabled;

  const send = () => {
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText("");
    setPickerOpen(false);
  };

  const insertEmoji = (emoji: string) => {
    setText((current) => `${current}${emoji}`);
    textareaRef.current?.focus();
  };

  async function startRecording() {
    setRecorderError(null);
    if (!supported) {
      setRecorderError("当前浏览器不支持录音");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime =
        MediaRecorder.isTypeSupported?.("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported?.("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported?.("audio/ogg") ? "audio/ogg"
        : "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        chunksRef.current = [];
        if (blob.size === 0) {
          setRecording("idle");
          return;
        }
        setRecording("transcribing");
        try {
          const result = await transcribeAudio(blob, "zh");
          if (result.ok && result.text) {
            setText((current) => (current ? `${current}${current.endsWith(" ") ? "" : " "}${result.text}` : result.text!));
            textareaRef.current?.focus();
          } else if (result.code === "asr_not_configured") {
            // ASR explicitly off and no multimodal-LLM fallback wired up yet.
            // Stay silent — the mic button would not even be visible in this
            // state, so reaching here is a transient race we ignore.
          } else if (result.message) {
            setRecorderError(result.message);
          }
        } catch (error) {
          setRecorderError(error instanceof Error ? error.message : "录音上传失败");
        } finally {
          setRecording("idle");
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording("recording");
    } catch (error) {
      setRecorderError(error instanceof Error ? error.message : "无法访问麦克风（可能未授权）");
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    recorderRef.current = null;
  }

  React.useEffect(() => () => stopRecording(), []);

  const micLabel = recording === "recording" ? "停止录音并转写" : recording === "transcribing" ? "转写中" : "按住录音，松开转写";

  return (
    <div className="safe-bottom sticky bottom-0 z-20 border-t border-border bg-bg/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-bg/90">
      <div className="mx-auto max-w-[760px]">
        {recorderError ? (
          <div className="mb-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            {recorderError}
          </div>
        ) : null}
        {pickerOpen ? (
          <div className="mb-2 rounded-xl border border-border bg-bg-elevated p-3 shadow-card">
            <div className="grid grid-cols-10 gap-1">
              {emojiOptions.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex h-9 items-center justify-center rounded-md text-xl hover:bg-bg-muted"
                  onClick={() => insertEmoji(emoji)}
                  disabled={disabled}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stickerOptions.map((sticker) => (
                <button
                  key={sticker.keyword}
                  type="button"
                  className="rounded-lg border border-border bg-bg px-3 py-2 text-left text-sm text-text hover:bg-bg-muted disabled:opacity-50"
                  onClick={() => {
                    onSendSticker?.(sticker);
                    setPickerOpen(false);
                  }}
                  disabled={disabled || !onSendSticker}
                >
                  <span className="mr-1 text-base">{sticker.emoji}</span>
                  {sticker.keyword}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex items-end gap-2 rounded-xl border border-border-strong bg-bg-elevated p-2 shadow-card">
          {showMic ? (
            <Button
              variant={recording === "recording" ? "destructive" : "ghost"}
              size="icon-sm"
              aria-label={micLabel}
              title={micLabel}
              disabled={disabled || recording === "transcribing"}
              onClick={() => {
                if (recording === "idle") void startRecording();
                else if (recording === "recording") stopRecording();
              }}
            >
              {recording === "recording" ? <Square className="h-4 w-4" />
                : recording === "transcribing" ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Mic className="h-4 w-4" />}
            </Button>
          ) : null}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={recording === "recording" ? "正在录音…" : recording === "transcribing" ? "转写中…" : "发消息"}
            disabled={disabled}
            className="max-h-28 min-h-8 flex-1 resize-none bg-transparent px-1 py-1.5 text-base leading-6 text-text placeholder:text-text-subtle focus:outline-none disabled:opacity-50"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="表情"
            disabled={disabled}
            onClick={() => setPickerOpen((open) => !open)}
          >
            <Smile className="h-4 w-4" />
          </Button>
          <Button size="icon-sm" aria-label="发送" onClick={send} disabled={!text.trim() || disabled}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
