import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const composeFile = process.env.STAGING_COMPOSE_FILE ?? 'docker-compose.staging.yml';
const envFile = process.env.STAGING_ENV_FILE ?? 'deploy/staging.env.example';
const service = process.env.STAGING_DB_SERVICE ?? 'postgres';
const backupDirectory = resolve(process.env.STAGING_BACKUP_DIR ?? 'backups/staging');

async function loadEnvFile() {
  try {
    const source = await readFile(resolve(envFile), 'utf8');
    return Object.fromEntries(
      source
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'))
        .map((line) => {
          const separator = line.indexOf('=');
          if (separator < 0) return ['', ''];
          const key = line.slice(0, separator).trim();
          const value = line
            .slice(separator + 1)
            .trim()
            .replace(/^(['"])(.*)\1$/u, '$2');
          return [key, value];
        })
        .filter(([key]) => key.length > 0),
    );
  } catch (error) {
    throw new Error(`Cannot read staging env file ${envFile}: ${String(error)}`);
  }
}

const fileEnv = await loadEnvFile();
const setting = (name, fallback) => process.env[name] ?? fileEnv[name] ?? fallback;
const database = setting('POSTGRES_DB', 'brecha_staging');
const user = setting('POSTGRES_USER', 'brecha_staging');

function assertIdentifier(value, label) {
  if (!/^[a-z_][a-z0-9_]*$/u.test(value)) {
    throw new Error(`${label} must be a safe PostgreSQL identifier.`);
  }
}

assertIdentifier(database, 'POSTGRES_DB');
assertIdentifier(user, 'POSTGRES_USER');

function composeArgs(args) {
  return ['compose', '--env-file', envFile, '-f', composeFile, ...args];
}

function runCompose(args, input) {
  return new Promise((resolveOutput, reject) => {
    const child = spawn('docker', composeArgs(args), { stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('error', reject);
    child.once('close', (code) => {
      const output = Buffer.concat(stdout);
      if (code === 0) resolveOutput(output);
      else {
        reject(
          new Error(
            `docker compose ${args.join(' ')} failed: ${Buffer.concat(stderr).toString('utf8')}`,
          ),
        );
      }
    });
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

function timestamp() {
  return new Date().toISOString().replaceAll(/[:.]/gu, '-');
}

function assertInsideDirectory(file) {
  if (dirname(file) !== backupDirectory) throw new Error('Unsafe staging backup output path.');
}

export async function createStagingBackup() {
  await mkdir(backupDirectory, { recursive: true });
  const file = resolve(backupDirectory, `${database}-${timestamp()}.dump`);
  assertInsideDirectory(file);
  const dump = await runCompose([
    'exec',
    '-T',
    service,
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
  } catch (error) {
    await Promise.all([
      rm(temporaryFile, { force: true }),
      rm(temporaryHash, { force: true }),
      rm(file, { force: true }),
    ]);
    throw error;
  }
  return { file, sha256 };
}

async function latestVerifiedBackup() {
  const files = (await readdir(backupDirectory)).filter((file) => file.endsWith('.dump')).sort();
  const fileName = files.at(-1);
  if (fileName === undefined) throw new Error('No staging backup exists; run pnpm staging:backup.');
  const file = resolve(backupDirectory, fileName);
  assertInsideDirectory(file);
  const [dump, expectedLine] = await Promise.all([
    readFile(file),
    readFile(`${file}.sha256`, 'utf8'),
  ]);
  const [expectedHash, expectedName] = expectedLine.trim().split(/\s+/u);
  if (expectedName !== basename(file))
    throw new Error('Staging backup checksum belongs to another file.');
  const actualHash = createHash('sha256').update(dump).digest('hex');
  if (actualHash !== expectedHash) throw new Error('Staging backup SHA-256 verification failed.');
  return { file, dump };
}

async function migrationCount() {
  const migrationsPath = resolve('apps/server/prisma/migrations');
  const entries = await readdir(migrationsPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).length;
}

export async function restoreStagingBackupSmoke() {
  const { file, dump } = await latestVerifiedBackup();
  const restoreDatabase = `brecha_restore_${Date.now().toString(36)}`;
  assertIdentifier(restoreDatabase, 'restore database');
  try {
    await runCompose([
      'exec',
      '-T',
      service,
      'psql',
      '--username',
      user,
      '--dbname',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      `CREATE DATABASE "${restoreDatabase}"`,
    ]);
    await runCompose(
      [
        'exec',
        '-T',
        service,
        'pg_restore',
        '--exit-on-error',
        '--no-owner',
        '--username',
        user,
        '--dbname',
        restoreDatabase,
      ],
      dump,
    );
    const result = await runCompose([
      'exec',
      '-T',
      service,
      'psql',
      '--username',
      user,
      '--dbname',
      restoreDatabase,
      '-At',
      '-c',
      'SELECT (SELECT COUNT(*) FROM "_prisma_migrations")::text || \' \' || (SELECT COUNT(*) FROM "User")::text',
    ]);
    const [migrations, users] = result.toString('utf8').trim().split(/\s+/u).map(Number);
    if (migrations !== (await migrationCount()) || users < 1) {
      throw new Error(
        `Restored staging database failed checks (migrations=${migrations}, users=${users}).`,
      );
    }
    return { file, migrations, users };
  } finally {
    await runCompose([
      'exec',
      '-T',
      service,
      'psql',
      '--username',
      user,
      '--dbname',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      `DROP DATABASE IF EXISTS "${restoreDatabase}"`,
    ]).catch(() => undefined);
  }
}

async function main() {
  const command = process.argv[2] ?? 'backup';
  try {
    if (command === 'backup') {
      const result = await createStagingBackup();
      console.info(`Staging backup created: ${result.file} (${result.sha256})`);
    } else if (command === 'restore-smoke') {
      const result = await restoreStagingBackupSmoke();
      console.info(
        `Staging restore smoke completed: ${result.migrations} migrations, ${result.users} users.`,
      );
    } else {
      throw new Error(`Unknown command ${command}; use backup or restore-smoke.`);
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

void main();
