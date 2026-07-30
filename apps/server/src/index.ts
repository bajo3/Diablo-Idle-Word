import { buildServer } from './app.js';
import { createDatabaseClient, disconnectDatabaseOnClose } from './persistence/database.js';

const host = process.env.SERVER_HOST ?? '0.0.0.0';
const parsedPort = Number.parseInt(process.env.SERVER_PORT ?? '3001', 10);
const port = Number.isNaN(parsedPort) ? 3001 : parsedPort;

const database = createDatabaseClient();
const app = buildServer({ database, logger: true });
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
