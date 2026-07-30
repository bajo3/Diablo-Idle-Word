import { createHash } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const backupDirectory = resolve('backups/dev');
const safeDatabaseNames = new Set(['brecha_oscura']);

type DevelopmentDatabase = { database: string; user: string };

function getDevelopmentDatabase(): DevelopmentDatabase {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Backup is disabled when NODE_ENV is production.');
  }
  const rawUrl = process.env.DATABASE_URL;
  if (rawUrl === undefined) throw new Error('DATABASE_URL is required for a development backup.');
  const url = new URL(rawUrl);
  const database = url.pathname.slice(1);
  if (!safeDatabaseNames.has(database) || !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('Backup is limited to the local development database brecha_oscura.');
  }
  if (url.username.length === 0) throw new Error('DATABASE_URL must include a PostgreSQL user.');
  return { database, user: decodeURIComponent(url.username) };
}

async function dockerCompose(args: string[]): Promise<Buffer> {
  return new Promise((resolveOutput, reject) => {
    const child = spawn('docker', ['compose', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => output.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolveOutput(Buffer.concat(output));
      else
        reject(
          new Error(`docker compose ${args.join(' ')} failed: ${Buffer.concat(errors).toString()}`),
        );
    });
  });
}

export async function createDevelopmentBackup(): Promise<{ file: string; sha256: string }> {
  const { database, user } = getDevelopmentDatabase();
  await mkdir(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  const file = resolve(backupDirectory, `${database}-${timestamp}.dump`);
  if (resolve(backupDirectory, basename(file)) !== file)
    throw new Error('Unsafe backup output path.');

  const dump = await dockerCompose([
    'exec',
    '-T',
    'postgres',
    'pg_dump',
    '--format=custom',
    '--no-owner',
    '--username',
    user,
    '--dbname',
    database,
  ]);
  const sha256 = createHash('sha256').update(dump).digest('hex');
  const temporaryFile = `${file}.tmp`;
  const temporaryHash = `${file}.sha256.tmp`;
  try {
    await writeFile(temporaryFile, dump, { flag: 'wx' });
    await rename(temporaryFile, file);
    await writeFile(temporaryHash, `${sha256}  ${basename(file)}\n`, { flag: 'wx' });
    await rename(temporaryHash, `${file}.sha256`);
  } catch (error: unknown) {
    await Promise.all([
      rm(temporaryFile, { force: true }),
      rm(temporaryHash, { force: true }),
      rm(file, { force: true }),
    ]);
    throw error;
  }
  return { file, sha256 };
}

async function main(): Promise<void> {
  try {
    const result = await createDevelopmentBackup();
    console.info(`Backup created: ${result.file} (${result.sha256})`);
  } catch (error: unknown) {
    console.error(error);
    process.exitCode = 1;
  }
}

void main();
