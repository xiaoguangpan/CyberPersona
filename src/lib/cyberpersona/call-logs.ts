import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { CallLogEntry, CallLogStatus, CallLogType } from "@/lib/types";
import { getRequiredPrismaClient } from "@/lib/cyberpersona/db";

const MAX_PER_TYPE = 100;
const MAX_SUMMARY = 240;
const MAX_REQUEST_BYTES = 8 * 1024;
const MAX_RESPONSE_BYTES = 16 * 1024;
let writeQueue = Promise.resolve();

function truncateString(value: string, limit: number) {
  if (value.length <= limit) return value;
  return value.slice(0, limit) + "…";
}

function summarize(input: unknown, limit = MAX_SUMMARY): string {
  if (input == null) return "";
  if (typeof input === "string") return truncateString(input.replace(/\s+/g, " ").trim(), limit);
  try {
    const json = JSON.stringify(input);
    return truncateString(json, limit);
  } catch {
    return truncateString(String(input), limit);
  }
}

function clip(value: unknown, limit: number): unknown {
  if (value == null) return value;
  try {
    const json = JSON.stringify(value);
    if (json.length <= limit) return value;
    return { _truncated: true, preview: json.slice(0, limit) + "…" };
  } catch {
    const text = String(value);
    return text.length <= limit ? text : text.slice(0, limit) + "…";
  }
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

function normalizeEntry(entry: CallLogEntry): CallLogEntry {
  return {
    id: entry.id || `log_${entry.type}_${randomUUID()}`,
    type: entry.type,
    provider: entry.provider || "unknown",
    source: entry.source || "server",
    startedAt: entry.startedAt || new Date().toISOString(),
    durationMs: Math.max(0, Math.round(entry.durationMs || 0)),
    streaming: Boolean(entry.streaming),
    status: entry.status,
    inputSummary: truncateString(entry.inputSummary || "", MAX_SUMMARY),
    outputSummary: truncateString(entry.outputSummary || "", MAX_SUMMARY),
    errorMessage: entry.errorMessage ? truncateString(entry.errorMessage, MAX_SUMMARY) : undefined,
    request: clip(entry.request, MAX_REQUEST_BYTES),
    response: clip(entry.response, MAX_RESPONSE_BYTES),
  };
}

function toCreateInput(entry: CallLogEntry): Prisma.CallLogCreateManyInput {
  return {
    id: entry.id,
    type: entry.type,
    provider: entry.provider,
    source: entry.source,
    startedAt: new Date(entry.startedAt),
    durationMs: entry.durationMs,
    streaming: entry.streaming,
    status: entry.status,
    inputSummary: entry.inputSummary,
    outputSummary: entry.outputSummary,
    errorMessage: entry.errorMessage,
    request: toJsonValue(entry.request),
    response: toJsonValue(entry.response),
  };
}

function fromDb(row: {
  id: string;
  type: string;
  provider: string;
  source: string;
  startedAt: Date;
  durationMs: number;
  streaming: boolean;
  status: string;
  inputSummary: string;
  outputSummary: string;
  errorMessage: string | null;
  request: Prisma.JsonValue | null;
  response: Prisma.JsonValue | null;
}): CallLogEntry {
  return {
    id: row.id,
    type: row.type as CallLogType,
    provider: row.provider,
    source: row.source,
    startedAt: row.startedAt.toISOString(),
    durationMs: row.durationMs,
    streaming: row.streaming,
    status: row.status as CallLogStatus,
    inputSummary: row.inputSummary,
    outputSummary: row.outputSummary,
    errorMessage: row.errorMessage || undefined,
    request: row.request ?? undefined,
    response: row.response ?? undefined,
  };
}

async function getCallLogClient() {
  return getRequiredPrismaClient();
}

export type RecordCallInput = {
  type: CallLogType;
  provider: string;
  source: string;
  startedAt: number;
  durationMs: number;
  streaming?: boolean;
  status: CallLogStatus;
  inputSummary?: string;
  outputSummary?: string;
  errorMessage?: string;
  request?: unknown;
  response?: unknown;
};

export async function recordCall(input: RecordCallInput): Promise<CallLogEntry> {
  const entry = normalizeEntry({
    id: `log_${input.type}_${randomUUID()}`,
    type: input.type,
    provider: input.provider,
    source: input.source,
    startedAt: new Date(input.startedAt).toISOString(),
    durationMs: input.durationMs,
    streaming: Boolean(input.streaming),
    status: input.status,
    inputSummary: input.inputSummary ?? "",
    outputSummary: input.outputSummary ?? "",
    errorMessage: input.errorMessage,
    request: input.request,
    response: input.response,
  });

  const task = writeQueue.then(async () => {
    const prisma = await getCallLogClient();
    await prisma.callLog.create({ data: toCreateInput(entry) });
    const oldRows = await prisma.callLog.findMany({
      where: { type: input.type },
      orderBy: { startedAt: "desc" },
      skip: MAX_PER_TYPE,
      select: { id: true },
    });
    if (oldRows.length) await prisma.callLog.deleteMany({ where: { id: { in: oldRows.map((row) => row.id) } } });
    return entry;
  });
  writeQueue = task.then(() => undefined, () => undefined);
  return task;
}

export async function listCalls(type: CallLogType, limit = 50): Promise<CallLogEntry[]> {
  const prisma = await getCallLogClient();
  const take = Math.max(1, Math.min(limit, MAX_PER_TYPE));
  const rows = await prisma.callLog.findMany({
    where: { type },
    orderBy: { startedAt: "desc" },
    take,
  });
  return rows.map(fromDb);
}

export async function getCallById(id: string): Promise<CallLogEntry | null> {
  const prisma = await getCallLogClient();
  const row = await prisma.callLog.findUnique({ where: { id } });
  return row ? fromDb(row) : null;
}

export async function clearCalls(type?: CallLogType): Promise<void> {
  const task = writeQueue.then(async () => {
    const prisma = await getCallLogClient();
    await prisma.callLog.deleteMany(type ? { where: { type } } : undefined);
  });
  writeQueue = task.then(() => undefined, () => undefined);
  await task;
}

export { summarize };
