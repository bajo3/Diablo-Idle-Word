import 'dotenv/config';

import { CharacterRepository } from '../src/persistence/character-repository.js';
import { createDatabaseClient } from '../src/persistence/database.js';

export async function seedDatabase(databaseUrl = process.env.DATABASE_URL): Promise<void> {
  const prisma = createDatabaseClient(databaseUrl);
  try {
    const repository = new CharacterRepository(prisma);
    const existing = await repository.getOwned('user:seed', 'character:seed-guardian');
    if (existing !== null) return;

    await repository.create({
      user: { id: 'user:seed', email: 'seed@local.invalid' },
      character: {
        id: 'character:seed-guardian',
        name: 'Guardian Seed',
        attributes: { strength: 10, dexterity: 10, intelligence: 10, vitality: 10 },
        materials: 0n,
        inventory: { id: 'inventory:seed-guardian', capacity: 40, schemaVersion: 1, items: [] },
        equipment: [],
        progress: {
          id: 'progress:seed-guardian',
          level: 1,
          experience: 0n,
          attributePoints: 0,
          schemaVersion: 1,
        },
        skills: [
          {
            id: 'skill:seed-basic-attack',
            abilityId: 'guardian:basic_attack',
            level: 1,
            unlocked: true,
            equipped: true,
            barSlot: 0,
          },
        ],
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

try {
  await seedDatabase();
  console.info('Seed completed: user:seed / character:seed-guardian');
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
