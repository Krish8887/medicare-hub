import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaClientGen: number | undefined
}

/**
 * Bump CLIENT_GEN whenever the generated Prisma client changes at runtime
 * (e.g. after `prisma db push` adds a model while the dev server is running).
 * Hot reload then creates a fresh client instead of reusing the stale one
 * cached on globalThis, avoiding "Cannot read properties of undefined" errors
 * for newly added models (e.g. db.invoice).
 */
const CLIENT_GEN = 2

export const db =
  globalForPrisma.prisma && globalForPrisma.prismaClientGen === CLIENT_GEN
    ? globalForPrisma.prisma
    : new PrismaClient({
        log: ['query'],
      })

globalForPrisma.prisma = db
globalForPrisma.prismaClientGen = CLIENT_GEN
