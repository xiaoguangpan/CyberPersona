#!/usr/bin/env node
// Cross-platform data wipe used during local debugging.
// Clears PostgreSQL-backed CyberPersona state and generated media files.
import { existsSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const mediaDir = path.join(webRoot, ".cyberpersona-media");
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error("DATABASE_URL is required. CyberPersona now stores runtime data in PostgreSQL.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function clearDirectory(dir) {
  if (!existsSync(dir)) return 0;
  const entries = await readdir(dir, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    await rm(full, { force: true, recursive: true });
    removed += 1;
  }
  return removed;
}

try {
  await prisma.$transaction([
    prisma.chatSendRequest.deleteMany(),
    prisma.mediaAsset.deleteMany(),
    prisma.callLog.deleteMany(),
    prisma.providerSettings.deleteMany(),
    prisma.appState.deleteMany(),
  ]);

  const mediaCleared = await clearDirectory(mediaDir);
  console.log("database tables cleared: appState, providerSettings, callLog, chatSendRequest, mediaAsset");
  console.log(`media files cleared: ${mediaCleared}`);
  console.log("Done. You can now restart `npm run dev`.");
} finally {
  await prisma.$disconnect();
}
