import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { spawn } from 'node:child_process';

import { Client } from 'pg';

import { createDatabaseClient } from '../apps/server/src/persistence/database.js';

const backupDirectory = resolve('backups/dev');
const restorePrefix = 'brecha_restore_';
const migrationsDirectory = resolve('apps/server/prisma/migrations');

function getDevelopmentDatabaseUrl(): URL {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Restore smoke testing is disabled when NODE_ENV is production.');
  }
  const rawUrl = process.env.DATABASE_URL;
  if (rawUrl === undefined) throw new Error('DATABASE_URL is required for restore smoke testing.');
  const url = new URL(rawUrl);
  if (url.pathname !== '/brecha_oscura' || !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('Restore smoke testing is limited to local brecha_oscura backups.');
  }
  return url;
}

function assertRestoreDatabaseName(name: string): void {
  if (!/^brecha_restore_[a-z0-9_]+$/.test(name)) {
    throw new Error(`Refusing a non-restore database name: ${name}`);
  }
}

async function dockerCompose(args: string[]): Promise<void> {
  await new Promise<void>((resolveDone, reject) => {
    const child = spawn('docker', ['compose', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    const errors: Buffer[] = [];
    child.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolveDone();
      else
        reject(
          new Error(`docker compose ${args.join(' ')} failed: ${Buffer.concat(errors).toString()}`),
        );
    });
  });
}

async function latestVerifiedBackup(): Promise<string> {
  const files = (await readdir(backupDirectory)).filter((file) => file.endsWith('.dump')).sort();
  const fileName = files.at(-1);
  if (fileName === undefined)
    throw new Error('No development backup exists; run pnpm db:backup first.');
  const file = resolve(backupDirectory, fileName);
  if (resolve(backupDirectory, basename(file)) !== file)
    throw new Error('Unsafe backup input path.');
  const [dump, expectedLine] = await Promise.all([
    readFile(file),
    readFile(`${file}.sha256`, 'utf8'),
  ]);
  const [expectedHash, expectedName] = expectedLine.trim().split(/\s+/);
  if (expectedName !== basename(file))
    throw new Error('Backup checksum belongs to a different file.');
  const actualHash = createHash('sha256').update(dump).digest('hex');
  if (actualHash !== expectedHash) throw new Error('Backup SHA-256 verification failed.');
  return file;
}

async function expectedMigrationCount(): Promise<bigint> {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  return BigInt(entries.filter((entry) => entry.isDirectory()).length);
}

export async function restoreSmoke(): Promise<void> {
  const sourceUrl = getDevelopmentDatabaseUrl();
  const backupFile = await latestVerifiedBackup();
  const database = `${restorePrefix}${randomUUID().replaceAll('-', '')}`;
  assertRestoreDatabaseName(database);
  const user = decodeURIComponent(sourceUrl.username);
  const adminUrl = new URL(sourceUrl);
  adminUrl.pathname = '/postgres';
  const restoreUrl = new URL(sourceUrl);
  restoreUrl.pathname = `/${database}`;
  const containerFile = `/tmp/${basename(backupFile)}`;
  const admin = new Client({ connectionString: adminUrl.toString() });

  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    await dockerCompose(['cp', backupFile, `postgres:${containerFile}`]);
    await dockerCompose([
      'exec',
      '-T',
      'postgres',
      'pg_restore',
      '--exit-on-error',
      '--no-owner',
      '--username',
      user,
      '--dbname',
      database,
      containerFile,
    ]);

    const prisma = createDatabaseClient(restoreUrl.toString());
    try {
      await prisma.$queryRaw`SELECT 1`;
      const migrations = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations"
      `;
      if (migrations[0]?.count !== (await expectedMigrationCount()))
        throw new Error('Restored database is missing migration history.');
      const tableCounts = await Promise.all([
        prisma.user.count(),
        prisma.character.count(),
        prisma.inventory.count(),
        prisma.inventoryItem.count(),
        prisma.equipment.count(),
        prisma.characterSkill.count(),
        prisma.characterProgress.count(),
        prisma.awayCalibration.count(),
        prisma.awaySession.count(),
        prisma.awayResult.count(),
        prisma.missionResult.count(),
        prisma.rewardLog.count(),
      ]);
      if (tableCounts.some((count) => count < 0)) throw new Error('Invalid restored table count.');
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    await dockerCompose(['exec', '-T', 'postgres', 'rm', '-f', containerFile]).catch(
      () => undefined,
    );
    assertRestoreDatabaseName(database);
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
}

async function main(): Promise<void> {
  try {
    await restoreSmoke();
    console.info('Restore smoke completed with a verified backup and isolated restore database.');
  } catch (error: unknown) {
    console.error(error);
    process.exitCode = 1;
  }
}

void main();
