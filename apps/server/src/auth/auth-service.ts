import { createHash, randomBytes, randomUUID } from 'node:crypto';

import argon2 from 'argon2';

import { Prisma } from '../generated/prisma/client.js';
import type { DatabaseClient } from '../persistence/database.js';

import {
  type AuthenticatedPrincipal,
  InvalidCredentialsError,
  type LoginInput,
  RegistrationConflictError,
  type RegisterInput,
  type UpdateProfileInput,
  UnauthenticatedError,
} from './contracts.js';

const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const argon2Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const;
// Valid Argon2id output with the exact policy above. It equalizes the expensive verify path when
// an email has no usable credential; it is not an account credential or a secret.
const dummyPasswordHash =
  '$argon2id$v=19$m=19456,p=1,t=2$kcuMOlqF1odnzyuvLQ+GSw$Yk5ClnsM+pMDQyXTAkJpBCTVwW5gc+kUXeryXxaO5RE';

export type AuthSession = {
  expiresAt: Date;
  principal: AuthenticatedPrincipal;
  token: string;
};

export type PublicProfile = {
  email: string;
  id: string;
  displayName: string;
};

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export class AuthService {
  public constructor(
    private readonly prisma: DatabaseClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async register(input: RegisterInput, previousToken?: string): Promise<AuthSession> {
    const now = this.now();
    const passwordHash = await argon2.hash(input.password, argon2Options);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            id: `user:${randomUUID()}`,
            email: input.email,
            displayName: input.displayName,
            passwordHash,
          },
        });
        await this.revokeToken(transaction, previousToken, now);
        return this.createSession(transaction, user, now);
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) throw new RegistrationConflictError();
      throw error;
    }
  }

  public async login(input: LoginInput, previousToken?: string): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const storedPasswordHash = user?.passwordHash;
    const isValid = await argon2.verify(storedPasswordHash ?? dummyPasswordHash, input.password);
    if (
      user === null ||
      storedPasswordHash === undefined ||
      storedPasswordHash === null ||
      !isValid
    ) {
      throw new InvalidCredentialsError();
    }
    const validPasswordHash = storedPasswordHash;

    const now = this.now();
    return this.prisma.$transaction(async (transaction) => {
      await this.revokeToken(transaction, previousToken, now);
      if (await argon2.needsRehash(validPasswordHash, argon2Options)) {
        await transaction.user.update({
          where: { id: user.id },
          data: {
            passwordHash: await argon2.hash(input.password, argon2Options),
            revision: { increment: 1 },
          },
        });
      }
      return this.createSession(transaction, user, now);
    });
  }

  public async authenticate(token: string | undefined): Promise<AuthenticatedPrincipal> {
    if (token === undefined || token.length === 0) throw new UnauthenticatedError();
    const now = this.now();
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { user: true },
    });
    if (session === null || session.revokedAt !== null || session.expiresAt <= now) {
      throw new UnauthenticatedError();
    }
    await this.prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: now } });
    return { sessionId: session.id, userId: session.userId, email: session.user.email };
  }

  /** Rotates the bearer value while retaining its original absolute expiry. */
  public async rotate(token: string | undefined): Promise<AuthSession> {
    if (token === undefined || token.length === 0) throw new UnauthenticatedError();
    const now = this.now();
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { user: true },
    });
    if (session === null || session.revokedAt !== null || session.expiresAt <= now) {
      throw new UnauthenticatedError();
    }
    return this.prisma.$transaction(async (transaction) => {
      await transaction.session.update({
        where: { id: session.id },
        data: { revokedAt: now, lastUsedAt: now },
      });
      return this.createSession(transaction, session.user, now, session.expiresAt);
    });
  }

  public async logout(token: string | undefined): Promise<void> {
    if (token === undefined || token.length === 0) return;
    await this.prisma.session.updateMany({
      where: { tokenHash: tokenHash(token), revokedAt: null },
      data: { revokedAt: this.now() },
    });
  }

  public async getProfile(userId: string): Promise<PublicProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user === null) throw new UnauthenticatedError();
    return { id: user.id, email: user.email, displayName: user.displayName };
  }

  public async updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicProfile> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { displayName: input.displayName, revision: { increment: 1 } },
    });
    return { id: user.id, email: user.email, displayName: user.displayName };
  }

  private async createSession(
    transaction: Prisma.TransactionClient,
    user: { id: string; email: string },
    now: Date,
    expiresAt = new Date(now.getTime() + sessionLifetimeMs),
  ): Promise<AuthSession> {
    const token = newToken();
    const id = `session:${randomUUID()}`;
    await transaction.session.create({
      data: { id, userId: user.id, tokenHash: tokenHash(token), expiresAt, lastUsedAt: now },
    });
    return { token, expiresAt, principal: { sessionId: id, userId: user.id, email: user.email } };
  }

  private async revokeToken(
    transaction: Prisma.TransactionClient,
    token: string | undefined,
    now: Date,
  ): Promise<void> {
    if (token === undefined || token.length === 0) return;
    await transaction.session.updateMany({
      where: { tokenHash: tokenHash(token), revokedAt: null },
      data: { revokedAt: now },
    });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export const authSecurity = {
  argon2: {
    memoryCost: argon2Options.memoryCost,
    parallelism: argon2Options.parallelism,
    timeCost: argon2Options.timeCost,
  },
  dummyVerification: true,
  sessionLifetimeMs,
};
