import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildServer } from './app.js';
import { createDatabaseClient, disconnectDatabaseOnClose } from './persistence/database.js';

const host = process.env.SERVER_HOST ?? '0.0.0.0';
// PORT is what most hosts (Railway included) inject; SERVER_PORT stays as the local override.
const parsedPort = Number.parseInt(process.env.PORT ?? process.env.SERVER_PORT ?? '3001', 10);
const port = Number.isNaN(parsedPort) ? 3001 : parsedPort;

/**
 * In a single-origin deployment this process also serves the built frontend. `SERVE_WEB=1` resolves
 * the workspace's own `apps/web/dist` (this file runs from `apps/server/dist`), while WEB_DIST_PATH
 * accepts an explicit path. Unset in local development, where Vite serves the frontend itself.
 */
const webDistPath =
  process.env.WEB_DIST_PATH ??
  (process.env.SERVE_WEB === '1'
    ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist')
    : undefined);

const database = createDatabaseClient();
const app = buildServer({
  database,
  logger: true,
  ...(webDistPath === undefined ? {} : { webDistPath }),
});
disconnectDatabaseOnClose(app, database);

function closeGracefully(): void {
  void app.close().catch((error: unknown) => {
    app.log.error(error);
    process.exitCode = 1;
  });
}

process.once('SIGINT', closeGracefully);
process.once('SIGTERM', closeGracefully);

try {
  await app.listen({ host, port });
} catch (error: unknown) {
  app.log.error(error);
  process.exitCode = 1;
}
