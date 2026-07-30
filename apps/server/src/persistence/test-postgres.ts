import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

import { Client } from 'pg';

import { createDatabaseClient, type DatabaseClient } from './database.js';

const execFileAsync = promisify(execFile);
const testDatabasePrefix = 'brecha_test_';

export function assertSafeTestEnvironment(
  databaseUrl: string,
  nodeEnvironment = process.env.NODE_ENV,
): void {
  if (nodeEnvironment === 'production') {
    throw new Error('Refusing to create or drop integration databases in production.');
  }
  const url = new URL(databaseUrl);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('Integration tests only allow localhost PostgreSQL.');
  }
  if (url.pathname !== '/brecha_oscura') {
    throw new Error('Integration tests require DATABASE_URL to target brecha_oscura.');
  }
}

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required to run PostgreSQL integration tests.');
  }
  assertSafeTestEnvironment(databaseUrl);
  return databaseUrl;
}

function makeDatabaseUrl(baseUrl: string, databaseName: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function assertTestDatabaseName(databaseName: string): void {
  if (!/^brecha_test_[a-z0-9_]+$/.test(databaseName)) {
    throw new Error(`Refusing a non-test database name: ${databaseName}`);
  }
}

async function runPrisma(args: string[], databaseUrl: string): Promise<void> {
  await execFileAsync(process.execPath, [resolve('node_modules/prisma/build/index.js'), ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

export type TestPostgres = {
  databaseName: string;
  databaseUrl: string;
  prisma: DatabaseClient;
  seed(): Promise<void>;
  cleanup(): Promise<void>;
};

/**
 * Builds a fresh, isolated database and applies only versioned migrations. No SQLite, db push,
 * reset, or production database is involved. cleanup is safe only for brecha_test_* databases.
 */
export async function createTestPostgres(): Promise<TestPostgres> {
  const baseUrl = requireDatabaseUrl();
  const databaseName = `${testDatabasePrefix}${randomUUID().replaceAll('-', '')}`;
  assertTestDatabaseName(databaseName);

  const adminUrl = makeDatabaseUrl(baseUrl, 'postgres');
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await admin.end();
  }

  const databaseUrl = makeDatabaseUrl(baseUrl, databaseName);
  try {
    await runPrisma(['migrate', 'deploy'], databaseUrl);
  } catch (error: unknown) {
    const cleanupClient = new Client({ connectionString: adminUrl });
    await cleanupClient.connect();
    try {
      await cleanupClient.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    } finally {
      await cleanupClient.end();
    }
    throw error;
  }

  const prisma = createDatabaseClient(databaseUrl);
  return {
    databaseName,
    databaseUrl,
    prisma,
    async seed() {
      await runPrisma(['db', 'seed'], databaseUrl);
    },
    async cleanup() {
      await prisma.$disconnect();
      const cleanupClient = new Client({ connectionString: adminUrl });
      await cleanupClient.connect();
      try {
        assertTestDatabaseName(databaseName);
        await cleanupClient.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      } finally {
        await cleanupClient.end();
      }
    },
  };
}
