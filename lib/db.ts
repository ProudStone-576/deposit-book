import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * One client per process. On serverless every cold start is a new process, so
 * the pooled Neon connection string matters: unpooled Postgres would run out of
 * connections long before it ran out of traffic.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["error"] : [] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
