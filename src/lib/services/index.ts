import type {
  AlbumItem,
  AdminChatRecord,
  AdminPersonaRow,
  AdminProviderSettings,
  AdminTurnRecord,
  AdminUserRow,
  CallLogEntry,
  CallLogType,
  ChatMessage,
  Persona,
  UserProfile,
} from "../types";

export type SendUserMessageInput = {
  text: string;
  type?: "text" | "sticker";
  stickerKeyword?: string;
  stickerEmoji?: string;
  clientRequestId?: string;
};

type CooldownState = {
  cooldownUntil: string;
  breakupCountToday: number;
  lastBrokenPersonaId?: string;
};

type ReconcileResult =
  | { ok: true; status: "accepted" | "rejected" | "pending"; message?: string }
  | { ok: false; status: "blocked_active" | "not_found"; message: string };

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function requireOk<T extends { ok?: boolean; message?: string }>(response: Response): Promise<T> {
  const data = await parseJson<T>(response);
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "请求失败");
  }
  return data;
}

async function postJson<T extends { ok?: boolean; message?: string }>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return requireOk<T>(response);
}

async function putJson<T extends { ok?: boolean; message?: string }>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return requireOk<T>(response);
}

async function deleteJson<T extends { ok?: boolean; message?: string }>(url: string): Promise<T> {
  const response = await fetch(url, { method: "DELETE" });
  return requireOk<T>(response);
}

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  const response = await fetch("/api/auth/me");
  if (response.status === 401) return null;
  const result = await requireOk<{ ok: boolean; user: UserProfile }>(response);
  return result.user;
}

export async function login(input: { phone: string; password: string }): Promise<UserProfile> {
  const result = await postJson<{ ok: boolean; user: UserProfile; message?: string }>("/api/auth/login", input);
  return result.user;
}

export async function register(input: { phone: string; password: string; confirmPassword: string }): Promise<UserProfile> {
  const result = await postJson<{ ok: boolean; user: UserProfile; message?: string }>("/api/auth/register", input);
  return result.user;
}

export async function logout(): Promise<void> {
  await postJson<{ ok: boolean; message?: string }>("/api/auth/logout");
}

export async function changePassword(input: { currentPassword: string; newPassword: string; confirmPassword: string }): Promise<void> {
  await postJson<{ ok: boolean; message?: string }>("/api/auth/change-password", input);
}

export async function fetchActivePersona(): Promise<Persona | null> {
  const response = await fetch("/api/personas/active");
  if (response.status === 401) return null;
  const result = await requireOk<{ ok: boolean; persona: Persona | null }>(response);
  return result.persona;
}

export async function fetchPersonaById(id: string): Promise<Persona | null> {
  const response = await fetch(`/api/personas/${encodeURIComponent(id)}`);
  if (response.status === 401) return null;
  const result = await requireOk<{ ok: boolean; persona: Persona | null }>(response);
  return result.persona;
}

export async function fetchBrokenUpPersonas(): Promise<Persona[]> {
  const response = await fetch("/api/personas/broken");
  if (response.status === 401) return [];
  const result = await requireOk<{ ok: boolean; personas: Persona[] }>(response);
  return result.personas;
}

export async function assignNewPersona(): Promise<Persona> {
  const result = await postJson<{ ok: boolean; persona: Persona; messages: ChatMessage[]; album: AlbumItem[]; message?: string }>("/api/personas/assign");
  return result.persona;
}

export async function fetchBreakupCooldown(): Promise<CooldownState | null> {
  const response = await fetch("/api/breakup/cooldown");
  if (response.status === 401) return null;
  const result = await requireOk<{ ok: boolean; cooldown: CooldownState | null }>(response);
  return result.cooldown;
}

export async function breakupActivePersona(): Promise<{
  ok: true;
  cooldownUntil: string;
  cooldownMinutes: number;
  breakupCountToday: number;
  lastBrokenPersonaId: string;
}> {
  return postJson("/api/breakup/active");
}

export async function reconcilePersona(id: string): Promise<ReconcileResult> {
  const response = await fetch(`/api/personas/${encodeURIComponent(id)}/reconcile`, { method: "POST" });
  const result = await parseJson<ReconcileResult>(response);
  if (!response.ok && result.ok !== false) throw new Error("复合请求失败");
  return result;
}

export async function fetchActiveMessages(): Promise<ChatMessage[]> {
  const response = await fetch("/api/messages/active");
  if (response.status === 401) return [];
  const result = await requireOk<{ ok: boolean; messages: ChatMessage[] }>(response);
  return result.messages;
}

export async function fetchArchivedMessages(personaId: string): Promise<ChatMessage[]> {
  const response = await fetch(`/api/personas/${encodeURIComponent(personaId)}/messages`);
  if (response.status === 401) return [];
  const result = await requireOk<{ ok: boolean; messages: ChatMessage[] }>(response);
  return result.messages;
}

export async function sendUserMessage(input: SendUserMessageInput): Promise<{ user: ChatMessage; assistant: ChatMessage[]; creditsSpent?: number; creditsLeft?: number }> {
  const result = await postJson<{ ok: boolean; user: ChatMessage; assistant: ChatMessage[]; creditsSpent?: number; creditsLeft?: number; message?: string }>("/api/chat/send", input);
  return { user: result.user, assistant: result.assistant, creditsSpent: result.creditsSpent, creditsLeft: result.creditsLeft };
}

export async function fetchAlbumByPersona(personaId: string): Promise<AlbumItem[]> {
  const response = await fetch(`/api/personas/${encodeURIComponent(personaId)}/album`);
  if (response.status === 401) return [];
  const result = await requireOk<{ ok: boolean; album: AlbumItem[] }>(response);
  return result.album;
}

export async function fetchAdminOverview() {
  const result = await requireOk<{ ok: boolean; overview: {
    totalUsers: number;
    activeUsers7d: number;
    activePersonas: number;
    brokenUpPersonas: number;
    messagesToday: number;
    turnsToday: number;
    creditsConsumedToday: number;
    usersInCooldown: number;
    fallbackRate: number;
    errorRate: number;
  } }>(await fetch("/api/admin/overview"));
  return result.overview;
}

export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const result = await requireOk<{ ok: boolean; users: AdminUserRow[] }>(await fetch("/api/admin/users"));
  return result.users;
}

export async function fetchAdminPersonas(): Promise<AdminPersonaRow[]> {
  const result = await requireOk<{ ok: boolean; personas: AdminPersonaRow[] }>(await fetch("/api/admin/personas"));
  return result.personas;
}

export async function fetchAdminTurns(): Promise<AdminTurnRecord[]> {
  const result = await requireOk<{ ok: boolean; turns: AdminTurnRecord[] }>(await fetch("/api/admin/turns"));
  return result.turns;
}

export async function fetchAdminChats(): Promise<AdminChatRecord[]> {
  const result = await requireOk<{ ok: boolean; chats: AdminChatRecord[] }>(await fetch("/api/admin/chats"));
  return result.chats;
}

export async function fetchAdminSettings(): Promise<AdminProviderSettings> {
  const result = await requireOk<{ ok: boolean; settings: AdminProviderSettings }>(await fetch("/api/admin/settings"));
  return result.settings;
}

export async function updateAdminSettings(next: AdminProviderSettings): Promise<AdminProviderSettings> {
  const result = await putJson<{ ok: boolean; settings: AdminProviderSettings; message?: string }>("/api/admin/settings", next);
  return result.settings;
}

export async function updateAdminUserStatus(input: { userId: string; status: AdminUserRow["status"] }): Promise<{ ok: true }> {
  return putJson(`/api/admin/users/${encodeURIComponent(input.userId)}/status`, { status: input.status });
}

export async function deleteAdminUser(userId: string): Promise<{ ok: true }> {
  return deleteJson(`/api/admin/users/${encodeURIComponent(userId)}`);
}

export async function resetAdminUserPassword(userId: string): Promise<{ temporaryPassword: string }> {
  const result = await postJson<{ ok: boolean; temporaryPassword: string; message?: string }>(`/api/admin/users/${encodeURIComponent(userId)}/reset-password`);
  return { temporaryPassword: result.temporaryPassword };
}

export async function updateAdminUserCredits(input: { userId: string; credits: number }): Promise<{ ok: true }> {
  return putJson(`/api/admin/users/${encodeURIComponent(input.userId)}/credits`, { credits: input.credits });
}

export async function setAdminUserRole(input: { userId: string; isAdmin: boolean }): Promise<{ ok: true }> {
  return putJson(`/api/admin/users/${encodeURIComponent(input.userId)}/admin`, { isAdmin: input.isAdmin });
}

export async function fetchAdminCallLogs(type: CallLogType, limit = 50): Promise<CallLogEntry[]> {
  const result = await requireOk<{ ok: boolean; logs: CallLogEntry[] }>(
    await fetch(`/api/admin/call-logs?type=${encodeURIComponent(type)}&limit=${limit}`),
  );
  return result.logs;
}

export async function fetchAdminCallLogDetail(id: string): Promise<CallLogEntry> {
  const result = await requireOk<{ ok: boolean; log: CallLogEntry }>(
    await fetch(`/api/admin/call-logs/${encodeURIComponent(id)}`),
  );
  return result.log;
}

export type AdminTestResult = {
  ok: boolean;
  status: "ok" | "error" | "fallback" | "unconfigured";
  message?: string;
  detail?: string;
  durationMs?: number;
  text?: string;
  imageUrl?: string;
  stickerUrl?: string;
  audioDataUrl?: string;
};

export async function testAdminLlm(prompt?: string): Promise<AdminTestResult> {
  const response = await fetch("/api/admin/test/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  return (await response.json()) as AdminTestResult;
}

export async function testAdminImage(prompt?: string): Promise<AdminTestResult> {
  const response = await fetch("/api/admin/test/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  return (await response.json()) as AdminTestResult;
}

export async function testAdminSticker(keyword?: string): Promise<AdminTestResult> {
  const response = await fetch("/api/admin/test/sticker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyword }),
  });
  return (await response.json()) as AdminTestResult;
}

export async function testAdminTts(text?: string): Promise<AdminTestResult> {
  const response = await fetch("/api/admin/test/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return (await response.json()) as AdminTestResult;
}

export async function transcribeAudio(blob: Blob, language = "zh"): Promise<{ ok: boolean; text?: string; message?: string; code?: string }> {
  const form = new FormData();
  const filename = blob.type.includes("ogg") ? "voice.ogg" : blob.type.includes("wav") ? "voice.wav" : "voice.webm";
  form.set("file", new File([blob], filename, { type: blob.type || "audio/webm" }));
  form.set("language", language);
  const response = await fetch("/api/asr", { method: "POST", body: form });
  return (await response.json()) as { ok: boolean; text?: string; message?: string; code?: string };
}

export type VoiceInputStatus = { ok: boolean; asrEnabled: boolean; llmAudioEnabled: boolean };

export async function fetchVoiceInputStatus(): Promise<VoiceInputStatus> {
  try {
    const response = await fetch("/api/voice-input/status");
    return (await response.json()) as VoiceInputStatus;
  } catch {
    return { ok: false, asrEnabled: false, llmAudioEnabled: false };
  }
}
