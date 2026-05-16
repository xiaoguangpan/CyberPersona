"use client";

import * as React from "react";
import { Camera, ImageOff, Pause, Play, Smile } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";
import { LoadingDots } from "@/components/ui/loading";

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.type === "system") {
    return (
      <div className="my-4 flex justify-center px-4">
        <span className="rounded-full bg-bg-muted px-3 py-1 text-2xs text-text-subtle">
          {message.text}
        </span>
      </div>
    );
  }

  const isUser = message.role === "user";

  return (
    <div className={cn("flex px-4", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] animate-slide-up rounded-2xl px-4 py-2.5 text-base leading-6 md:max-w-[560px]",
          isUser
            ? "rounded-br-md bg-bubble-out text-bubble-out-fg"
            : "rounded-bl-md bg-bubble-in text-bubble-in-fg",
          message.type === "image" && "p-1.5",
          message.type === "sticker" && "bg-transparent p-0",
        )}
      >
        {message.type === "text" ? <p className="whitespace-pre-wrap">{message.text}</p> : null}
        {message.type === "voice" ? <VoiceMessage message={message} /> : null}
        {message.type === "image" ? <ImageMessage message={message} /> : null}
        {message.type === "image_loading" ? <ImageLoadingMessage message={message} /> : null}
        {message.type === "image_failed" ? <ImageFailedMessage message={message} /> : null}
        {message.type === "sticker" ? <StickerMessage message={message} /> : null}
      </div>
    </div>
  );
}

function VoiceMessage({ message }: { message: ChatMessage }) {
  const { isPlaying, progress, durationSec, toggle } = useAudio(message.audioUrl, message.audioDurationSec ?? 3);
  const bars = [8, 14, 20, 12, 24, 16, 10, 18, 13, 22, 15, 9];
  const safeProgress = Math.max(0, Math.min(1, progress));
  return (
    <button
      type="button"
      className="flex min-w-[184px] items-center gap-3 text-left"
      aria-label={isPlaying ? "暂停语音" : "播放语音"}
      onClick={toggle}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bg text-text shadow-card">
        {isPlaying ? (
          <Pause className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
        )}
      </span>
      <span className="flex flex-1 flex-col gap-1.5">
        <span className="flex items-center gap-0.5 opacity-80">
          {bars.map((height, index) => (
            <span
              key={index}
              className={cn("w-0.5 rounded-full bg-current transition-all", isPlaying && "animate-pulse")}
              style={{ height: isPlaying ? height + (index % 3) * 2 : height }}
            />
          ))}
        </span>
        <span className="h-1 overflow-hidden rounded-full bg-current/15">
          <span
            className="block h-full rounded-full bg-current transition-[width] duration-150"
            style={{ width: `${safeProgress * 100}%` }}
          />
        </span>
      </span>
      <span className="tabular text-xs opacity-70">
        {formatDuration(durationSec)}
      </span>
    </button>
  );
}

function useAudio(src: string | undefined, fallbackDurationSec: number) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [durationSec, setDurationSec] = React.useState(fallbackDurationSec);

  React.useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    setDurationSec(fallbackDurationSec);
    if (!src) {
      audioRef.current = null;
      return;
    }

    const audio = new Audio(src);
    audioRef.current = audio;

    const updateProgress = () => {
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : fallbackDurationSec;
      setDurationSec(Math.max(1, Math.round(duration)));
      setProgress(duration > 0 ? audio.currentTime / duration : 0);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      audio.currentTime = 0;
    };

    audio.addEventListener("loadedmetadata", updateProgress);
    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", updateProgress);
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audioRef.current = null;
    };
  }, [fallbackDurationSec, src]);

  const toggle = React.useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      return;
    }
    audio.pause();
  }, []);

  return { isPlaying, progress, durationSec, toggle };
}

function ImageMessage({ message }: { message: ChatMessage }) {
  return (
    <figure className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={message.imageUrl}
        alt={message.imageCaption ?? "聊天图片"}
        className="max-h-[360px] w-[min(280px,60vw)] rounded-xl object-cover"
      />
      {message.imageCaption ? (
        <figcaption className="px-2 pb-1 text-sm text-text-muted">
          {message.imageCaption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function ImageLoadingMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex min-h-[160px] w-[min(280px,60vw)] flex-col items-center justify-center gap-3 rounded-xl bg-bg-muted px-4 text-center text-text-muted">
      <Camera className="h-5 w-5" />
      <p className="text-sm">{message.imageWaitText ?? "正在生成照片"}</p>
      <LoadingDots />
    </div>
  );
}

function ImageFailedMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex min-h-[120px] w-[min(280px,60vw)] flex-col items-center justify-center gap-3 rounded-xl bg-bg-muted px-4 text-center text-text-muted">
      <ImageOff className="h-5 w-5" />
      <p className="text-sm">{message.imageFailedText ?? "图片生成失败"}</p>
    </div>
  );
}

function StickerMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-border bg-bg-muted">
        {message.stickerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={message.stickerUrl} alt="表情包" className="h-24 w-24" />
        ) : message.stickerEmoji ? (
          <span className="text-5xl">{message.stickerEmoji}</span>
        ) : (
          <Smile className="h-8 w-8 text-text-muted" />
        )}
      </div>
      {message.stickerKeyword ? (
        <span className="pl-1 text-2xs text-text-subtle">{message.stickerKeyword}</span>
      ) : null}
    </div>
  );
}
