import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'apps/server/prisma/schema.prisma',
  migrations: {
    path: 'apps/server/prisma/migrations',
    seed: 'tsx apps/server/prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
