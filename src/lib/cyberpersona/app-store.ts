import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { AlbumItem, AdminChatRecord, AdminPersonaRow, AdminTurnRecord, AdminUserRow, ChatMessage, Persona, UserProfile } from "@/lib/types";
import { getProviderSettings } from "@/lib/cyberpersona/provider-settings";
import { createInitialPersonaBundle, generateConsistentPersonaImage } from "@/lib/cyberpersona/server";
import { runTurnWithLlm } from "@/lib/cyberpersona/llm";
import { applyTurnDelta, type TurnOutput } from "@/lib/cyberpersona/turn";
import { getRequiredPrismaClient } from "@/lib/cyberpersona/db";

export type StoredUser = UserProfile & {
  passwordHash: string;
  passwordSalt: string;
  status: AdminUserRow["status"];
  creationCountDate: string;
  breakupCountDate: string;
  creditsConsumed: number;
  isAdmin: boolean;
};

type StoredSession = {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

type AppState = {
  version: number;
  users: StoredUser[];
  sessions: StoredSession[];
  personas: Persona[];
  messages: Record<string, ChatMessage[]>;
  albums: Record<string, AlbumItem[]>;
  turns: AdminTurnRecord[];
};

export type SendUserMessageInput = {
  text: string;
  type?: "text" | "sticker";
  stickerKeyword?: string;
  stickerEmoji?: string;
  clientRequestId?: string;
};

export type ReconcileResult =
  | { ok: true; status: "accepted" | "rejected"; message: string }
  | { ok: false; status: "blocked_active" | "not_found"; message: string };

const sessionCookieName = "cyberpersona_session";
const appStateKey = "default";
let writeQueue = Promise.resolve();

export function getSessionCookieName() {
  return sessionCookieName;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function compactIntentText(text: string) {
  return text.replace(/\s+/g, "").replace(/[，。！？!?,.、；;：:~～…]/g, "");
}

function messageText(message: ChatMessage) {
  return [message.text, message.imageCaption, message.imageFailedText, message.stickerKeyword].filter(Boolean).join(" ");
}

function userExplicitlyRequestsImage(text: string) {
  const compact = compactIntentText(text);
  if (!compact) return false;
  return /照片|自拍|图片|相片|发图|发张|拍张|拍一张|看看你|看下你|看一下你/.test(compact);
}

function assistantClaimsImageSent(text: string) {
  const compact = compactIntentText(text);
  if (/不发|不能发|不给你发|不想发/.test(compact)) return false;
  return /照片.*(发给你|发了|已发|发出来)|自拍.*(发给你|发了|已发|发出来)|图片.*(发给你|发了|已发|发出来)|你先看照片|先看照片|这张(照片|自拍).*(给你|发给你|发了|已发|发出来|先看)/.test(compact);
}

function shouldGenerateAssistantImage(inputText: string, replyText: string, turn: TurnOutput) {
  return turn.sendImageNow
    || userExplicitlyRequestsImage(inputText)
    || assistantClaimsImageSent(replyText);
}

function buildAssistantImagePrompt(inputText: string, replyText: string, messages: ChatMessage[]) {
  const recent = messages.slice(-6).map((message) => `${message.role}: ${messageText(message)}`).filter((line) => line.trim()).join("\n");
  return [
    "Casual realistic phone selfie of the same young Chinese woman from the persona reference photo.",
    `Current user request: ${inputText}`,
    replyText ? `Assistant reply context: ${replyText}` : "",
    recent ? `Recent conversation context:\n${recent}` : "",
    "Follow any mentioned outfit, pose, place, or mood. Natural iPhone front-camera look, realistic skin texture, no text, no watermark, no studio glamour.",
  ].filter(Boolean).join("\n");
}

function emptyState(): AppState {
  return {
    version: 1,
    users: [],
    sessions: [],
    personas: [],
    messages: {},
    albums: {},
    turns: [],
  };
}

async function readState(): Promise<AppState> {
  const prisma = getRequiredPrismaClient();
  const row = await prisma.appState.findUnique({ where: { key: appStateKey } });
  if (row) return normalizeState(row.data as Partial<AppState>);

  const initial = emptyState();
  await prisma.appState.create({ data: { key: appStateKey, data: initial } });
  return initial;
}

function normalizeState(parsed: Partial<AppState>): AppState {
  const users: StoredUser[] = (parsed.users ?? []).map((user) => ({
    ...(user as StoredUser),
    isAdmin: Boolean((user as StoredUser).isAdmin),
  }));
  return {
    version: parsed.version ?? 1,
    users,
    sessions: parsed.sessions ?? [],
    personas: parsed.personas ?? [],
    messages: parsed.messages ?? {},
    albums: parsed.albums ?? {},
    turns: parsed.turns ?? [],
  };
}

async function writeState(state: AppState) {
  const prisma = getRequiredPrismaClient();
  await prisma.appState.upsert({
    where: { key: appStateKey },
    create: { key: appStateKey, data: state },
    update: { data: state },
  });
}

async function updateState<T>(mutator: (state: AppState) => T | Promise<T>): Promise<T> {
  const task = writeQueue.then(async () => {
    const state = await readState();
    state.sessions = state.sessions.filter((session) => new Date(session.expiresAt).getTime() > Date.now());
    const result = await mutator(state);
    await writeState(state);
    return result;
  });
  writeQueue = task.then(() => undefined, () => undefined);
  return task;
}

function publicUser(user: StoredUser): UserProfile {
  const date = todayKey();
  const todayCreationCount = user.creationCountDate === date ? user.todayCreationCount : 0;
  const breakupCountToday = user.breakupCountDate === date ? user.breakupCountToday : 0;
  return {
    id: user.id,
    phone: user.phone,
    avatarColor: user.avatarColor,
    credits: user.credits,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    todayCreationCount,
    dailyCreationLimit: user.dailyCreationLimit,
    breakupCountToday,
    cooldownUntil: user.cooldownUntil,
    isAdmin: Boolean(user.isAdmin),
  };
}

function adminBootstrapPhone() {
  return (process.env.ADMIN_BOOTSTRAP_PHONE || "").trim();
}

function shouldBeAdmin(phone: string, state: AppState) {
  const bootstrap = adminBootstrapPhone();
  if (bootstrap && bootstrap === phone) return true;
  const hasAnyAdmin = state.users.some((item) => item.isAdmin && item.status !== "deleted");
  if (!bootstrap && !hasAnyAdmin) return true;
  return false;
}

function assertPhone(phone: string) {
  if (!/^1\d{10}$/.test(phone)) throw new Error("手机号格式不正确");
}

function assertPassword(password: string) {
  if (password.length < 6) throw new Error("密码至少 6 位");
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, 120_000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function verifyPassword(password: string, user: StoredUser) {
  const next = hashPassword(password, user.passwordSalt).hash;
  const currentBuffer = Buffer.from(user.passwordHash, "hex");
  const nextBuffer = Buffer.from(next, "hex");
  return currentBuffer.length === nextBuffer.length && timingSafeEqual(currentBuffer, nextBuffer);
}

function sessionExpiry() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

function createStoredSession(userId: string): StoredSession {
  return {
    token: randomBytes(32).toString("hex"),
    userId,
    createdAt: nowIso(),
    expiresAt: sessionExpiry(),
  };
}

function randomAvatarColor() {
  const colors = ["#1c1917", "#7c2d12", "#831843", "#312e81", "#164e63", "#14532d"];
  return colors[Math.floor(Math.random() * colors.length)];
}

export async function registerUser(input: { phone: string; password: string; confirmPassword: string }) {
  assertPhone(input.phone);
  assertPassword(input.password);
  if (input.password !== input.confirmPassword) throw new Error("两次输入的密码不一致");
  const settings = await getProviderSettings();
  return updateState((state) => {
    const existing = state.users.find((user) => user.phone === input.phone && user.status !== "deleted");
    if (existing) throw new Error("该手机号已注册");
    const { salt, hash } = hashPassword(input.password);
    const now = nowIso();
    const user: StoredUser = {
      id: `u_${randomUUID()}`,
      phone: input.phone,
      avatarColor: randomAvatarColor(),
      credits: settings.credits.initialBalance,
      createdAt: now,
      lastLoginAt: now,
      todayCreationCount: 0,
      dailyCreationLimit: settings.relationship.dailyCreationLimit,
      breakupCountToday: 0,
      creationCountDate: todayKey(),
      breakupCountDate: todayKey(),
      creditsConsumed: 0,
      passwordHash: hash,
      passwordSalt: salt,
      status: "active",
      isAdmin: false,
    };
    user.isAdmin = shouldBeAdmin(input.phone, state);
    const session = createStoredSession(user.id);
    state.users.push(user);
    state.sessions.push(session);
    return { user: publicUser(user), session };
  });
}

export async function loginUser(input: { phone: string; password: string }) {
  assertPhone(input.phone);
  assertPassword(input.password);
  return updateState((state) => {
    const user = state.users.find((item) => item.phone === input.phone && item.status !== "deleted");
    if (!user || !verifyPassword(input.password, user)) throw new Error("手机号或密码不正确");
    if (user.status === "disabled") throw new Error("账号已停用，请联系管理员");
    if (shouldBeAdmin(user.phone, state)) user.isAdmin = true;
    user.lastLoginAt = nowIso();
    const session = createStoredSession(user.id);
    state.sessions.push(session);
    return { user: publicUser(user), session };
  });
}

export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string, currentSessionToken?: string | null) {
  assertPassword(newPassword);
  if (currentPassword === newPassword) throw new Error("新密码不能与当前密码相同");
  await updateState((state) => {
    const user = state.users.find((item) => item.id === userId && item.status === "active");
    if (!user) throw new Error("账号不存在或已停用");
    if (!verifyPassword(currentPassword, user)) throw new Error("当前密码不正确");
    const { salt, hash } = hashPassword(newPassword);
    user.passwordSalt = salt;
    user.passwordHash = hash;
    // Invalidate every session except the current one to log other devices out.
    state.sessions = state.sessions.filter((session) => session.userId !== user.id || session.token === currentSessionToken);
  });
}

export async function logoutSession(token?: string) {
  if (!token) return;
  await updateState((state) => {
    state.sessions = state.sessions.filter((session) => session.token !== token);
  });
}

export async function getUserBySession(token?: string | null) {
  if (!token) return null;
  const state = await readState();
  const session = state.sessions.find((item) => item.token === token && new Date(item.expiresAt).getTime() > Date.now());
  if (!session) return null;
  const user = state.users.find((item) => item.id === session.userId && item.status === "active");
  return user ? publicUser(user) : null;
}

export async function getActivePersona(userId: string) {
  const state = await readState();
  return state.personas.find((persona) => persona.userId === userId && persona.status === "active") ?? null;
}

export async function getPersonaForUser(userId: string, personaId: string) {
  const state = await readState();
  return state.personas.find((persona) => persona.userId === userId && persona.id === personaId) ?? null;
}

export async function getBrokenPersonas(userId: string) {
  const state = await readState();
  return state.personas
    .filter((persona) => persona.userId === userId && (persona.status === "broken_up" || persona.status === "reconciliation_pending"))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function assignPersona(userId: string) {
  const settings = await getProviderSettings();
  const preState = await readState();
  const user = preState.users.find((item) => item.id === userId && item.status === "active");
  if (!user) throw new Error("账号不存在或已停用");
  if (preState.personas.some((persona) => persona.userId === userId && persona.status === "active")) {
    throw new Error("当前已有女友");
  }
  if (user.cooldownUntil && new Date(user.cooldownUntil).getTime() > Date.now()) {
    throw new Error("分手冷静期尚未结束");
  }
  const creationCount = user.creationCountDate === todayKey() ? user.todayCreationCount : 0;
  if (creationCount >= settings.relationship.dailyCreationLimit) {
    throw new Error("今日分配次数已达上限");
  }
  const bundle = await createInitialPersonaBundle();
  return updateState((state) => {
    const storedUser = state.users.find((item) => item.id === userId && item.status === "active");
    if (!storedUser) throw new Error("账号不存在或已停用");
    if (state.personas.some((persona) => persona.userId === userId && persona.status === "active")) {
      throw new Error("当前已有女友");
    }
    const date = todayKey();
    if (storedUser.creationCountDate !== date) {
      storedUser.creationCountDate = date;
      storedUser.todayCreationCount = 0;
    }
    storedUser.todayCreationCount += 1;
    storedUser.dailyCreationLimit = settings.relationship.dailyCreationLimit;
    const persona: Persona = { ...bundle.persona, userId };
    const messages = bundle.messages.map((message) => ({ ...message, personaId: persona.id }));
    const album = bundle.album.map((item) => ({ ...item, personaId: persona.id }));
    state.personas.push(persona);
    state.messages[persona.id] = messages;
    state.albums[persona.id] = album;
    return { persona, messages, album };
  });
}

export async function getBreakupCooldown(userId: string) {
  const state = await readState();
  const user = state.users.find((item) => item.id === userId);
  if (!user?.cooldownUntil || new Date(user.cooldownUntil).getTime() <= Date.now()) return null;
  const broken = state.personas
    .filter((persona) => persona.userId === userId && persona.status === "broken_up")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
  return {
    cooldownUntil: user.cooldownUntil,
    breakupCountToday: user.breakupCountDate === todayKey() ? user.breakupCountToday : 0,
    lastBrokenPersonaId: broken?.id,
  };
}

export async function breakupActivePersona(userId: string) {
  const settings = await getProviderSettings();
  return updateState((state) => {
    const user = state.users.find((item) => item.id === userId && item.status === "active");
    if (!user) throw new Error("账号不存在或已停用");
    const persona = state.personas.find((item) => item.userId === userId && item.status === "active");
    if (!persona) throw new Error("当前没有可分手的女友");
    const date = todayKey();
    if (user.breakupCountDate !== date) {
      user.breakupCountDate = date;
      user.breakupCountToday = 0;
    }
    user.breakupCountToday = Math.min(user.breakupCountToday + 1, 3);
    const cooldownMinutes = settings.relationship.breakupCooldownMinutes[user.breakupCountToday - 1] ?? settings.relationship.breakupCooldownMinutes[2] ?? 60;
    user.cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString();
    persona.status = "broken_up";
    persona.brokenUpAt = nowIso();
    persona.updatedAt = persona.brokenUpAt;
    const message: ChatMessage = {
      id: `breakup_${persona.id}_${Date.now()}`,
      personaId: persona.id,
      role: "system",
      type: "system",
      text: "你们结束了这段关系，聊天记录已归档。",
      createdAt: persona.brokenUpAt,
    };
    state.messages[persona.id] = [...(state.messages[persona.id] ?? []), message];
    return {
      ok: true as const,
      cooldownUntil: user.cooldownUntil,
      cooldownMinutes,
      breakupCountToday: user.breakupCountToday,
      lastBrokenPersonaId: persona.id,
    };
  });
}

export async function requestReconciliation(userId: string, personaId: string): Promise<ReconcileResult> {
  return updateState((state) => {
    if (state.personas.some((persona) => persona.userId === userId && persona.status === "active")) {
      return { ok: false, status: "blocked_active", message: "已有当前女友时不能发起复合请求。" };
    }
    const persona = state.personas.find((item) => item.userId === userId && item.id === personaId && (item.status === "broken_up" || item.status === "reconciliation_pending"));
    if (!persona) return { ok: false, status: "not_found", message: "没有找到这段历史关系。" };
    const score = persona.dynamicState.trust + persona.dynamicState.closeness + persona.affectionLevel * 10 - persona.stress;
    const accepted = score >= 45;
    const time = nowIso();
    if (accepted) {
      persona.status = "active";
      persona.reconciledAt = time;
      persona.updatedAt = time;
      state.messages[persona.id] = [...(state.messages[persona.id] ?? []), {
        id: `reconciled_${persona.id}_${Date.now()}`,
        personaId: persona.id,
        role: "system",
        type: "system",
        text: "你们重新联系上了，这段关系回到当前关系。",
        createdAt: time,
      }];
      return { ok: true, status: "accepted", message: "她接受了重新联系，这段关系已恢复为当前关系。" };
    }
    persona.status = "broken_up";
    persona.updatedAt = time;
    state.messages[persona.id] = [...(state.messages[persona.id] ?? []), {
      id: `reconcile_rejected_${persona.id}_${Date.now()}`,
      personaId: persona.id,
      role: "system",
      type: "system",
      text: "你发起了重新联系，但她暂时没有接受。",
      createdAt: time,
    }];
    return { ok: true, status: "rejected", message: "她暂时没有接受重新联系。" };
  });
}

export async function getMessagesForPersona(userId: string, personaId: string) {
  const state = await readState();
  const persona = state.personas.find((item) => item.userId === userId && item.id === personaId);
  if (!persona) return [];
  return state.messages[personaId] ?? [];
}

export async function getActiveMessages(userId: string) {
  const active = await getActivePersona(userId);
  return active ? getMessagesForPersona(userId, active.id) : [];
}

export async function getAlbumForPersona(userId: string, personaId: string) {
  const state = await readState();
  const persona = state.personas.find((item) => item.userId === userId && item.id === personaId);
  if (!persona) return [];
  return state.albums[personaId] ?? [];
}

async function synthesizeAssistantVoice(origin: string, text: string, persona: Persona) {
  try {
    const response = await fetch(`${origin}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voiceSamplePath: persona.voiceSamplePath ?? persona.characterCard.voice.voiceSamplePath,
        context: persona.characterCard.voice.voiceStyle ? `按这个角色声音风格生成：${persona.characterCard.voice.voiceStyle}` : undefined,
      }),
    });
    if (!response.ok) return null;
    return await response.json() as { ok: boolean; audioUrl?: string; durationSec?: number };
  } catch {
    return null;
  }
}

async function generateAssistantImage(origin: string, prompt: string, persona: Persona, useReferencePhoto: boolean) {
  void origin;
  try {
    const appearance = persona.characterCard.appearance;
    const composedPrompt = [prompt, appearance.hair, appearance.skin, appearance.eye, appearance.photoOutfit, appearance.bodyType].filter(Boolean).join("，");
    const result = await generateConsistentPersonaImage({
      prompt: composedPrompt,
      referencePhotoUrl: useReferencePhoto ? persona.referencePhotoUrl : undefined,
      referencePhotoPath: useReferencePhoto ? (persona.referencePhotoPath ?? persona.characterCard.referencePhotoPath) : undefined,
      source: "chat-image",
    });
    if (result.fallback) return { ok: false, message: result.fallbackReason || "图片生成失败" };
    return { ok: true, imageUrl: result.url };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "图片生成失败" };
  }
}

async function generateAssistantSticker(origin: string, keyword: string) {
  try {
    const response = await fetch(`${origin}/api/sticker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    });
    if (!response.ok) return null;
    return await response.json() as { ok: boolean; stickerUrl?: string };
  } catch {
    return null;
  }
}

function messageCreditCost(messages: ChatMessage[], settings: Awaited<ReturnType<typeof getProviderSettings>>, includeDialogueTurnCost = true) {
  return messages.reduce((sum, message) => {
    if (message.role !== "assistant") return sum;
    if (message.type === "voice") return sum + settings.credits.voiceMessageCost;
    if (message.type === "image") return sum + settings.credits.imageMessageCost;
    if (message.type === "sticker") return sum + settings.credits.stickerMessageCost;
    if (message.type === "image_failed" || message.type === "image_loading") return sum;
    return sum + settings.credits.textMessageCost;
  }, includeDialogueTurnCost ? settings.credits.dialogueTurnCost : 0);
}

export async function sendUserMessage(userId: string, input: SendUserMessageInput, origin: string) {
  const settings = await getProviderSettings();
  const state = await readState();
  const user = state.users.find((item) => item.id === userId && item.status === "active");
  if (!user) throw new Error("账号不存在或已停用");
  const persona = state.personas.find((item) => item.userId === userId && item.status === "active");
  if (!persona) throw new Error("当前没有可聊天的女友。");
  if (user.credits < settings.credits.dialogueTurnCost) throw new Error("积分不足，无法发送消息。");

  const initialMessages = state.messages[persona.id] ?? [];
  const clientRequestId = input.clientRequestId?.trim();
  const existingUserMessage = clientRequestId
    ? initialMessages.find((message) => message.role === "user" && message.clientRequestId === clientRequestId)
    : undefined;
  if (existingUserMessage) return waitForExistingTurn(userId, persona.id, existingUserMessage, user.credits);

  const personaMessages = initialMessages;
  const now = Date.now();
  const turnId = `turn_${now}_${randomUUID()}`;
  const requestId = clientRequestId ?? turnId;
  const userMessage: ChatMessage = {
    id: `m_user_${now}_${randomUUID()}`,
    personaId: persona.id,
    role: "user",
    type: input.type ?? "text",
    text: input.text,
    stickerKeyword: input.stickerKeyword,
    stickerEmoji: input.stickerEmoji,
    clientRequestId,
    requestId,
    turnId,
    createdAt: new Date(now).toISOString(),
  };

  const existingDuringSave = await updateState((next) => {
    const storedUser = next.users.find((item) => item.id === userId && item.status === "active");
    const storedPersona = next.personas.find((item) => item.id === persona.id && item.userId === userId && item.status === "active");
    if (!storedUser || !storedPersona) throw new Error("当前会话已失效");
    if (storedUser.credits < settings.credits.dialogueTurnCost) throw new Error("积分不足，无法发送消息。");
    const messages = next.messages[persona.id] ?? [];
    const existing = clientRequestId
      ? messages.find((message) => message.role === "user" && message.clientRequestId === clientRequestId)
      : undefined;
    if (existing) return existing;
    next.messages[persona.id] = [...messages, userMessage];
    return undefined;
  });
  if (existingDuringSave) return waitForExistingTurn(userId, persona.id, existingDuringSave, user.credits);

  const turnResult = await runTurnWithLlm({
    persona,
    messages: personaMessages,
    userMessage: input.type === "sticker" ? `（用户发了一个表情包：${input.stickerKeyword ?? input.text}）` : input.text,
  });
  const turn: TurnOutput = turnResult.turn;
  const replyText = turn.visibleText;
  const assistant: ChatMessage = {
    id: `m_asst_${now + 1}_${randomUUID()}`,
    personaId: persona.id,
    role: "assistant",
    type: "text",
    text: replyText,
    clientRequestId,
    requestId,
    turnId,
    createdAt: new Date(now + 800).toISOString(),
  };
  const textCost = messageCreditCost([assistant], settings);

  const validationStatus: AdminTurnRecord["validationStatus"] = turnResult.status === "llm_ok"
    ? "ok"
    : turnResult.status === "llm_invalid"
      ? "fallback"
      : turnResult.status === "llm_unconfigured"
        ? "fallback"
        : "error";

  const savedText = await updateState((next) => {
    const storedUser = next.users.find((item) => item.id === userId && item.status === "active");
    const storedPersona = next.personas.find((item) => item.id === persona.id && item.userId === userId && item.status === "active");
    if (!storedUser || !storedPersona) throw new Error("当前会话已失效");
    if (storedUser.credits < textCost) throw new Error("积分不足，无法完成本轮回复。");
    storedUser.credits -= textCost;
    storedUser.creditsConsumed += textCost;
    applyTurnDelta(storedPersona, turn);
    storedPersona.affection += turn.stateDelta.closeness === "major_increase" ? 5 : turn.stateDelta.closeness === "minor_increase" ? 2 : 1;
    storedPersona.affectionLevel = Math.max(1, Math.min(10, Math.floor(storedPersona.affection / 100)));
    storedPersona.updatedAt = nowIso();
    next.messages[persona.id] = [...(next.messages[persona.id] ?? []), assistant];
    next.turns.unshift({
      id: turnId,
      requestId,
      turnId,
      personaId: persona.id,
      personaName: persona.nickname,
      userPhone: storedUser.phone,
      userMessage: input.text,
      visibleText: replyText,
      currentEmotion: storedPersona.currentEmotion,
      sendVoiceNow: false,
      sendImageNow: false,
      sendGifNow: false,
      validationStatus,
      latencyMs: turnResult.latencyMs,
      createdAt: new Date(now).toISOString(),
      stateDelta: turn.stateDelta,
      stressDelta: turn.stressDelta,
    });
    next.turns = next.turns.slice(0, 200);
    return { creditsLeft: storedUser.credits };
  });

  const shouldSendVoice = input.type !== "sticker" && (turn.sendVoiceNow || replyText.length >= 12);
  const wantImage = shouldGenerateAssistantImage(input.text, replyText, turn);
  const imagePrompt = wantImage ? turn.imagePrompt || buildAssistantImagePrompt(input.text, replyText, personaMessages) : "";
  const useReferencePhoto = turn.useReferencePhoto || Boolean(persona.referencePhotoUrl || persona.referencePhotoPath || persona.characterCard.referencePhotoPath);
  const stickerKeyword = input.type === "sticker"
    ? (input.stickerKeyword ?? input.text)
    : turn.sendGifNow && turn.gifKeyword
      ? turn.gifKeyword
      : null;

  // Media generation is intentionally parallel: image generation is the slowest
  // path, so waiting for TTS before starting the image makes photo replies feel
  // much slower than necessary.
  const [tts, image, sticker] = await Promise.all([
    shouldSendVoice ? synthesizeAssistantVoice(origin, replyText, persona) : Promise.resolve(null),
    wantImage ? generateAssistantImage(origin, imagePrompt, persona, useReferencePhoto) : Promise.resolve(null),
    stickerKeyword ? generateAssistantSticker(origin, stickerKeyword) : Promise.resolve(null),
  ]);

  const voiceAssistant: ChatMessage = tts?.ok && tts.audioUrl
    ? {
        ...assistant,
        type: "voice",
        audioUrl: tts.audioUrl,
        audioDurationSec: tts.durationSec,
      }
    : assistant;
  const imageMessage: ChatMessage | null = image?.ok && image.imageUrl
    ? {
        id: `m_img_${now + 2}_${randomUUID()}`,
        personaId: persona.id,
        role: "assistant",
        type: "image",
        imageUrl: image.imageUrl,
        imageCaption: turn.imageCaption || "这张更接近现在的我。",
        clientRequestId,
        requestId,
        turnId,
        createdAt: new Date(now + 1400).toISOString(),
      }
    : wantImage
      ? {
          id: `m_img_failed_${now + 2}_${randomUUID()}`,
          personaId: persona.id,
          role: "assistant",
          type: "image_failed",
          imageFailedText: turn.imageFailedText || image?.message || "这张照片刚才没发出来，我再试一次。",
          clientRequestId,
          requestId,
          turnId,
          createdAt: new Date(now + 1400).toISOString(),
        }
      : null;
  const mediaMessages: ChatMessage[] = [
    ...(imageMessage ? [imageMessage] : []),
    ...(sticker?.ok && sticker.stickerUrl ? [{
      id: `m_sticker_${now + 3}_${randomUUID()}`,
      personaId: persona.id,
      role: "assistant" as const,
      type: "sticker" as const,
      stickerUrl: sticker.stickerUrl,
      stickerKeyword: stickerKeyword ?? "",
      clientRequestId,
      requestId,
      turnId,
      createdAt: new Date(now + 1200).toISOString(),
    }] : []),
  ];
  const voiceCost = voiceAssistant.type === "voice"
    ? Math.max(0, settings.credits.voiceMessageCost - settings.credits.textMessageCost)
    : 0;
  const mediaCost = messageCreditCost(mediaMessages, settings, false) + voiceCost;

  const mediaResult = await updateState((next) => {
    const storedUser = next.users.find((item) => item.id === userId && item.status === "active");
    if (!storedUser) throw new Error("当前会话已失效");
    if (mediaCost > 0 && storedUser.credits < mediaCost) {
      return { assistant: [assistant], creditsSpent: textCost, creditsLeft: storedUser.credits };
    }
    if (mediaCost > 0) {
      storedUser.credits -= mediaCost;
      storedUser.creditsConsumed += mediaCost;
    }
    const messages = next.messages[persona.id] ?? [];
    next.messages[persona.id] = messages.map((message) => message.id === assistant.id ? voiceAssistant : message);
    if (mediaMessages.length > 0) next.messages[persona.id] = [...next.messages[persona.id], ...mediaMessages];
    const imageMessage = mediaMessages.find((message) => message.type === "image");
    if (imageMessage?.imageUrl) {
      const item: AlbumItem = {
        id: `album_${imageMessage.id}`,
        personaId: persona.id,
        imageUrl: imageMessage.imageUrl,
        caption: imageMessage.imageCaption,
        createdAt: imageMessage.createdAt,
        relatedMessageId: imageMessage.id,
      };
      next.albums[persona.id] = [...(next.albums[persona.id] ?? []), item];
    }
    const turnRecord = next.turns.find((item) => item.id === turnId);
    if (turnRecord) {
      turnRecord.sendVoiceNow = voiceAssistant.type === "voice";
      turnRecord.sendImageNow = mediaMessages.some((message) => message.type === "image" || message.type === "image_failed");
      turnRecord.sendGifNow = mediaMessages.some((message) => message.type === "sticker");
    }
    return { assistant: [voiceAssistant, ...mediaMessages], creditsSpent: textCost + mediaCost, creditsLeft: storedUser.credits };
  });

  return { user: userMessage, assistant: mediaResult.assistant, creditsSpent: mediaResult.creditsSpent, creditsLeft: mediaResult.creditsLeft ?? savedText.creditsLeft };
}

async function waitForExistingTurn(userId: string, personaId: string, userMessage: ChatMessage, fallbackCreditsLeft: number) {
  const requestId = userMessage.requestId ?? userMessage.clientRequestId ?? userMessage.turnId;
  const turnId = userMessage.turnId;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await readState();
    const storedUser = state.users.find((item) => item.id === userId && item.status === "active");
    const messages = state.messages[personaId] ?? [];
    const assistant = messages.filter((message) => {
      if (message.role !== "assistant") return false;
      if (requestId && message.requestId === requestId) return true;
      return Boolean(turnId && message.turnId === turnId);
    });
    if (assistant.length > 0) {
      return {
        user: userMessage,
        assistant,
        creditsSpent: 0,
        creditsLeft: storedUser?.credits ?? fallbackCreditsLeft,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const state = await readState();
  const storedUser = state.users.find((item) => item.id === userId && item.status === "active");
  return { user: userMessage, assistant: [], creditsSpent: 0, creditsLeft: storedUser?.credits ?? fallbackCreditsLeft };
}

function estimateCreditsSpent(messages: ChatMessage[], settings: Awaited<ReturnType<typeof getProviderSettings>>) {
  return messages.reduce((sum, message) => {
    if (message.role === "user") return sum + settings.credits.dialogueTurnCost;
    if (message.role !== "assistant") return sum;
    if (message.type === "voice") return sum + settings.credits.voiceMessageCost;
    if (message.type === "image") return sum + settings.credits.imageMessageCost;
    if (message.type === "sticker") return sum + settings.credits.stickerMessageCost;
    return sum + settings.credits.textMessageCost;
  }, 0);
}

export async function getAdminOverview() {
  const [state, settings] = await Promise.all([readState(), getProviderSettings()]);
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const today = todayKey();
  const allMessages = Object.values(state.messages).flat();
  return {
    totalUsers: state.users.filter((user) => user.status !== "deleted").length,
    activeUsers7d: state.users.filter((user) => new Date(user.lastLoginAt).getTime() >= sevenDaysAgo && user.status === "active").length,
    activePersonas: state.personas.filter((persona) => persona.status === "active").length,
    brokenUpPersonas: state.personas.filter((persona) => persona.status === "broken_up").length,
    messagesToday: allMessages.filter((message) => message.createdAt.startsWith(today)).length,
    turnsToday: state.turns.filter((turn) => turn.createdAt.startsWith(today)).length,
    creditsConsumedToday: Object.values(state.messages).flat().filter((message) => message.createdAt.startsWith(today)).length ? state.users.reduce((sum, user) => sum + user.creditsConsumed, 0) : 0,
    usersInCooldown: state.users.filter((user) => user.cooldownUntil && new Date(user.cooldownUntil).getTime() > Date.now()).length,
    fallbackRate: state.turns.length ? state.turns.filter((turn) => turn.validationStatus === "fallback").length / state.turns.length : 0,
    errorRate: state.turns.length ? state.turns.filter((turn) => turn.validationStatus === "error").length / state.turns.length : 0,
    configuredInitialCredits: settings.credits.initialBalance,
  };
}

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  const state = await readState();
  return state.users.map((user) => {
    const active = state.personas.find((persona) => persona.userId === user.id && persona.status === "active") ?? null;
    const userPersonas = state.personas.filter((persona) => persona.userId === user.id);
    const totalMessages = userPersonas.reduce((sum, persona) => sum + (state.messages[persona.id]?.length ?? 0), 0);
    const relationshipStatus: AdminUserRow["relationshipStatus"] = active
      ? "active"
      : user.cooldownUntil && new Date(user.cooldownUntil).getTime() > Date.now()
        ? "cooldown"
        : "unassigned";
    return {
      id: user.id,
      phone: user.phone,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      status: user.status,
      credits: user.credits,
      relationshipStatus,
      activePersonaName: active?.nickname ?? null,
      cooldownEndsAt: user.cooldownUntil ?? null,
      totalPersonas: userPersonas.length,
      totalMessages,
      totalTurns: state.turns.filter((turn) => userPersonas.some((persona) => persona.id === turn.personaId)).length,
      todayCreationCount: user.creationCountDate === todayKey() ? user.todayCreationCount : 0,
      isAdmin: Boolean(user.isAdmin),
    };
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function setUserAdmin(userId: string, isAdmin: boolean, currentAdminId: string) {
  await updateState((state) => {
    const target = state.users.find((item) => item.id === userId);
    if (!target) throw new Error("用户不存在");
    if (!isAdmin) {
      const remainingAdmins = state.users.filter((item) => item.isAdmin && item.id !== userId).length;
      if (remainingAdmins === 0) throw new Error("不能取消最后一个管理员");
      if (target.id === currentAdminId) throw new Error("请先把管理员权限转交给其他账号，再取消自己的管理员身份");
    }
    target.isAdmin = isAdmin;
  });
}

export async function getAdminPersonas(): Promise<AdminPersonaRow[]> {
  const state = await readState();
  return state.personas.map((persona) => {
    const user = state.users.find((item) => item.id === persona.userId);
    return {
      id: persona.id,
      userPhone: user?.phone ?? "未知用户",
      nickname: persona.nickname,
      status: persona.status,
      archetype: persona.characterCard.systemBase.personalityArchetype,
      createdAt: persona.createdAt,
      updatedAt: persona.updatedAt,
      sessionCount: persona.sessionCount,
      trust: persona.dynamicState.trust,
      closeness: persona.dynamicState.closeness,
      stress: persona.stress,
      affection: persona.affection,
    };
  }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getAdminTurns() {
  const state = await readState();
  return state.turns;
}

export async function getAdminChats(): Promise<AdminChatRecord[]> {
  const [state, settings] = await Promise.all([readState(), getProviderSettings()]);
  return state.personas.map((persona) => {
    const user = state.users.find((item) => item.id === persona.userId);
    const messages = state.messages[persona.id] ?? [];
    const lastText = [...messages].reverse().find((message) => message.text || message.imageCaption || message.stickerKeyword);
    return {
      id: `chat_${persona.id}`,
      userId: persona.userId,
      userPhone: user?.phone ?? "未知用户",
      personaId: persona.id,
      personaName: persona.nickname,
      personaStatus: persona.status,
      messageCount: messages.length,
      creditsSpent: estimateCreditsSpent(messages, settings),
      lastMessagePreview: lastText?.text ?? lastText?.imageCaption ?? lastText?.stickerKeyword ?? "暂无消息",
      lastMessageAt: messages.at(-1)?.createdAt ?? persona.updatedAt,
      messages,
    };
  }).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

export async function updateUserStatus(userId: string, status: AdminUserRow["status"]) {
  await updateState((state) => {
    const user = state.users.find((item) => item.id === userId);
    if (!user) throw new Error("用户不存在");
    user.status = status;
    if (status !== "active") {
      state.sessions = state.sessions.filter((session) => session.userId !== userId);
    }
  });
}

export async function deleteUser(userId: string) {
  await updateUserStatus(userId, "deleted");
}

export async function updateUserCredits(userId: string, credits: number) {
  await updateState((state) => {
    const user = state.users.find((item) => item.id === userId);
    if (!user) throw new Error("用户不存在");
    user.credits = Math.max(0, Math.floor(credits));
  });
}

export async function resetUserPassword(userId: string) {
  const temporaryPassword = `Cp${Math.floor(100000 + Math.random() * 900000)}`;
  await updateState((state) => {
    const user = state.users.find((item) => item.id === userId);
    if (!user) throw new Error("用户不存在");
    const { salt, hash } = hashPassword(temporaryPassword);
    user.passwordSalt = salt;
    user.passwordHash = hash;
    state.sessions = state.sessions.filter((session) => session.userId !== userId);
  });
  return temporaryPassword;
}
