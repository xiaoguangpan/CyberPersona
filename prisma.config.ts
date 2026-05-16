import { defineConfig } from "prisma/config";

const DEFAULT_DATABASE_URL = "postgresql://cyberpersona:cyberpersona@localhost:5432/cyberpersona?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL,
  },
  migrations: {
    path: "prisma/migrations",
  },
});
