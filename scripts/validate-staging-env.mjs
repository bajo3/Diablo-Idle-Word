import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const envFile = process.env.STAGING_ENV_FILE ?? 'deploy/staging.env.example';
const allowLocalhost = process.env.STAGING_ALLOW_LOCALHOST === '1';
const requireTls = process.env.STAGING_REQUIRE_TLS === '1';

async function readEnvFile() {
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
}

function isPlaceholder(value) {
  return /replace-with|change-me|example\.com|example\.invalid/iu.test(value);
}

function parseUrl(value, key, errors) {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) errors.push(`${key} must use HTTP(S).`);
    return parsed;
  } catch {
    errors.push(`${key} must be a valid URL.`);
    return undefined;
  }
}

function requireValue(settings, key, errors) {
  const value = settings[key];
  if (value === undefined || value.trim().length === 0) {
    errors.push(`${key} is required.`);
    return undefined;
  }
  return value;
}

async function main() {
  const fileSettings = await readEnvFile();
  const setting = (key) => process.env[key] ?? fileSettings[key] ?? '';
  const errors = [];
  const settings = Object.fromEntries(
    [
      'NODE_ENV',
      'SERVER_HOST',
      'POSTGRES_DB',
      'POSTGRES_USER',
      'POSTGRES_PASSWORD',
      'STAGING_WEB_ORIGIN',
      'STAGING_API_URL',
      'STAGING_WEB_URL',
      'STAGING_API_HEALTH_URL',
      'DATABASE_URL',
      'APP_ORIGIN',
      'STAGING_WEB_HOST',
      'STAGING_API_HOST',
    ].map((key) => [key, setting(key)]),
  );

  if (settings.NODE_ENV !== 'production') errors.push('NODE_ENV must be production for staging.');
  if (settings.SERVER_HOST !== '0.0.0.0') errors.push('SERVER_HOST must be 0.0.0.0 for staging.');

  const password = requireValue(settings, 'POSTGRES_PASSWORD', errors);
  const user = requireValue(settings, 'POSTGRES_USER', errors);
  const database = requireValue(settings, 'POSTGRES_DB', errors);
  if (password !== undefined) {
    if (password.length < 16) errors.push('POSTGRES_PASSWORD must contain at least 16 characters.');
    if (isPlaceholder(password)) errors.push('POSTGRES_PASSWORD still contains a template value.');
    if (password === user || password === database)
      errors.push('POSTGRES_PASSWORD must differ from database/user names.');
  }

  const webOrigin = parseUrl(
    requireValue(settings, 'STAGING_WEB_ORIGIN', errors) ?? '',
    'STAGING_WEB_ORIGIN',
    errors,
  );
  const apiUrl = parseUrl(
    requireValue(settings, 'STAGING_API_URL', errors) ?? '',
    'STAGING_API_URL',
    errors,
  );
  const webUrl = parseUrl(
    requireValue(settings, 'STAGING_WEB_URL', errors) ?? '',
    'STAGING_WEB_URL',
    errors,
  );
  const healthUrl = parseUrl(
    requireValue(settings, 'STAGING_API_HEALTH_URL', errors) ?? '',
    'STAGING_API_HEALTH_URL',
    errors,
  );
  const databaseUrl = requireValue(settings, 'DATABASE_URL', errors);

  if (webOrigin !== undefined) {
    if (webOrigin.pathname !== '/' || webOrigin.search || webOrigin.hash)
      errors.push('STAGING_WEB_ORIGIN must contain only scheme, host and optional port.');
    if (!allowLocalhost && ['localhost', '127.0.0.1', '::1'].includes(webOrigin.hostname))
      errors.push(
        'STAGING_WEB_ORIGIN still points to localhost; set STAGING_ALLOW_LOCALHOST=1 only for local checks.',
      );
    if (isPlaceholder(webOrigin.href))
      errors.push('STAGING_WEB_ORIGIN still contains a template host.');
  }
  for (const [key, parsed] of [
    ['STAGING_API_URL', apiUrl],
    ['STAGING_WEB_URL', webUrl],
    ['STAGING_API_HEALTH_URL', healthUrl],
  ]) {
    if (parsed !== undefined) {
      if (!allowLocalhost && ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname))
        errors.push(
          `${key} still points to localhost; set STAGING_ALLOW_LOCALHOST=1 only for local checks.`,
        );
      if (isPlaceholder(parsed.href)) errors.push(`${key} still contains a template host.`);
    }
  }
  if (webUrl !== undefined && webOrigin !== undefined && webUrl.origin !== webOrigin.origin)
    errors.push('STAGING_WEB_URL must match STAGING_WEB_ORIGIN.');
  if (healthUrl !== undefined && apiUrl !== undefined && healthUrl.origin !== apiUrl.origin)
    errors.push('STAGING_API_HEALTH_URL must match STAGING_API_URL origin.');
  if (requireTls) {
    for (const [key, parsed] of [
      ['STAGING_WEB_ORIGIN', webOrigin],
      ['STAGING_API_URL', apiUrl],
      ['STAGING_WEB_URL', webUrl],
      ['STAGING_API_HEALTH_URL', healthUrl],
    ]) {
      if (parsed !== undefined && parsed.protocol !== 'https:')
        errors.push(`${key} must use HTTPS.`);
    }
    if (isPlaceholder(settings.STAGING_WEB_HOST) || settings.STAGING_WEB_HOST.length === 0)
      errors.push('STAGING_WEB_HOST must be a real DNS name when TLS is required.');
    if (isPlaceholder(settings.STAGING_API_HOST) || settings.STAGING_API_HOST.length === 0)
      errors.push('STAGING_API_HOST must be a real DNS name when TLS is required.');
  }

  const appOrigin =
    settings.APP_ORIGIN.length > 0
      ? parseUrl(settings.APP_ORIGIN, 'APP_ORIGIN', errors)
      : webOrigin;
  if (appOrigin !== undefined && webOrigin !== undefined && appOrigin.origin !== webOrigin.origin)
    errors.push('APP_ORIGIN must match STAGING_WEB_ORIGIN.');

  if (databaseUrl !== undefined) {
    try {
      const parsed = new URL(databaseUrl);
      if (!['postgres:', 'postgresql:'].includes(parsed.protocol))
        errors.push('DATABASE_URL must use PostgreSQL.');
      if (isPlaceholder(parsed.password))
        errors.push('DATABASE_URL still contains a template password.');
    } catch {
      errors.push('DATABASE_URL must be a valid PostgreSQL URL.');
    }
  }

  if (errors.length > 0) {
    console.error(`Staging environment validation failed for ${envFile}:`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.info(
    JSON.stringify({
      envFile,
      nodeEnv: settings.NODE_ENV,
      tlsRequired: requireTls,
      webOrigin: webOrigin.origin,
      apiOrigin: apiUrl.origin,
      database: databaseUrl === undefined ? undefined : new URL(databaseUrl).hostname,
    }),
  );
}

main().catch((error) => {
  console.error(`Could not read staging environment ${envFile}: ${String(error)}`);
  process.exitCode = 1;
});
