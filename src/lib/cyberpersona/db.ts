import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const DEFAULT_DATABASE_URL = "postgresql://cyberpersona:cyberpersona@localhost:5432/cyberpersona?schema=public";

const globalForPrisma = globalThis as unknown as {
  cyberpersonaPrisma?: PrismaClient;
};

export function getDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
}

export function isDatabaseConfigured() {
  return true;
}

export function getPrismaClient() {
  const databaseUrl = getDatabaseUrl();

  if (!globalForPrisma.cyberpersonaPrisma) {
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    globalForPrisma.cyberpersonaPrisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.cyberpersonaPrisma;
}

export function getRequiredPrismaClient() {
  return getPrismaClient();
}
