import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Prisma, PrismaClient } from "@prisma/client";
import path from "node:path";

import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function prismaLogLevels() {
  return (process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]) as Prisma.LogLevel[];
}

function sqlitePathFromUrl(url: string) {
  if (!url.startsWith("file:")) {
    throw new Error("Expected a SQLite file: URL for local development");
  }

  const relativePath = url.replace(/^file:/, "").replace(/^\.?[\\/]/, "");

  return path.join(/* turbopackIgnore: true */ process.cwd(), relativePath);
}

function createPrismaClient() {
  if (env.DATABASE_PROVIDER === "sqlite") {
    const adapter = new PrismaBetterSqlite3({
      url: sqlitePathFromUrl(env.DATABASE_URL),
    });

    return new PrismaClient({
      adapter,
      log: prismaLogLevels(),
    });
  }

  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
  });

  return new PrismaClient({
    adapter,
    log: prismaLogLevels(),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
