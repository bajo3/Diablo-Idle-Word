import { CharacterClassIdSchema, type CharacterClassId } from '@brecha/shared';
import { z } from 'zod';

const visibleNamePattern = /^[\p{L}\p{N}][\p{L}\p{N} _'-]*$/u;

function normalizedText(value: string): string {
  return value.normalize('NFKC').trim();
}

export function normalizeEmail(value: string): string {
  return normalizedText(value).toLocaleLowerCase('en-US');
}

export function normalizeVisibleName(value: string): string {
  return normalizedText(value);
}

const EmailSchema = z.string().transform(normalizeEmail).pipe(z.string().email().max(320));
const PasswordSchema = z.string().min(6).max(128);

export const ProfileNameSchema = z
  .string()
  .transform(normalizeVisibleName)
  .pipe(z.string().min(3).max(64).regex(visibleNamePattern));

export const GuardianNameSchema = z
  .string()
  .transform(normalizeVisibleName)
  .pipe(z.string().min(3).max(24).regex(visibleNamePattern));

export const RegisterInputSchema = z.strictObject({
  email: EmailSchema,
  password: PasswordSchema,
  displayName: ProfileNameSchema,
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.strictObject({
  email: EmailSchema,
  password: PasswordSchema,
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const UpdateProfileInputSchema = z.strictObject({ displayName: ProfileNameSchema });
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;

export const CreateGuardianInputSchema = z.strictObject({
  name: GuardianNameSchema,
  class: CharacterClassIdSchema.default('GUARDIAN'),
});
export type CreateGuardianInput = z.infer<typeof CreateGuardianInputSchema>;
export type { CharacterClassId };

export type AuthenticatedPrincipal = {
  sessionId: string;
  userId: string;
  email: string;
};

export class InvalidCredentialsError extends Error {
  public constructor() {
    super('Invalid email or password.');
    this.name = 'InvalidCredentialsError';
  }
}

export class RegistrationConflictError extends Error {
  public constructor() {
    super('An account with that email already exists.');
    this.name = 'RegistrationConflictError';
  }
}

export class UnauthenticatedError extends Error {
  public constructor() {
    super('Authentication is required.');
    this.name = 'UnauthenticatedError';
  }
}

export class ForbiddenOriginError extends Error {
  public constructor() {
    super('The request origin is not allowed.');
    this.name = 'ForbiddenOriginError';
  }
}
