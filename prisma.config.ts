import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'apps/server/prisma/schema.prisma',
  migrations: {
    path: 'apps/server/prisma/migrations',
    // `tsx` is owned by the server workspace; invoke it through pnpm so the
    // seed also works inside the minimal staging image where the root has no
    // direct tsx binary.
    seed: 'pnpm --filter @brecha/server exec tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
