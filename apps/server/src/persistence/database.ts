import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client.js';

export type DatabaseClient = PrismaClient;

/** Creates a Prisma 7 client with the PostgreSQL driver adapter required at runtime. */
export function createDatabaseClient(databaseUrl = process.env.DATABASE_URL): PrismaClient {
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL must be set before creating the persistence client.');
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
}

type CloseHookHost = {
  addHook(name: 'onClose', hook: () => Promise<void>): unknown;
};

/** Registers one disconnect with Fastify's close lifecycle, never immediately after listen(). */
export function disconnectDatabaseOnClose(app: CloseHookHost, database: DatabaseClient): void {
  app.addHook('onClose', async () => database.$disconnect());
}
