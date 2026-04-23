import argon2 from 'argon2';
import { prisma } from '../../lib/prisma.js';
import { conflict, unauthorized } from '../../lib/errors.js';
import type { RegisterInput, LoginInput } from './auth.schemas.js';

function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'User';
  return local
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || 'User';
}

export const authService = {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw conflict('Email already registered');

    const passwordHash = await argon2.hash(input.password);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name?.trim() || displayNameFromEmail(input.email),
      },
    });
    return { id: user.id, email: user.email, name: user.name };
  },

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw unauthorized('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) throw unauthorized('Invalid credentials');

    return { id: user.id, email: user.email, name: user.name };
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    if (!user) throw unauthorized('User not found');
    return user;
  },
};
