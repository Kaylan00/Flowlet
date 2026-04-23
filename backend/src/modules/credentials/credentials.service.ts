import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../env.js';

const ALGO = 'aes-256-gcm';
const SECRET_KEY = Buffer.alloc(32);
Buffer.from(env.JWT_SECRET).copy(SECRET_KEY);

function encryptFields(fields: Record<string, string>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, SECRET_KEY, iv);
  const plain = JSON.stringify(fields);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}.${encrypted.toString('hex')}.${tag.toString('hex')}`;
}

function decryptFields(data: string): Record<string, string> {
  try {
    const parts = data.split('.');
    if (parts.length !== 3) return {};
    const iv = Buffer.from(parts[0], 'hex');
    const enc = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const decipher = createDecipheriv(ALGO, SECRET_KEY, iv);
    decipher.setAuthTag(tag);
    const plain = decipher.update(enc).toString('utf8') + decipher.final('utf8');
    return JSON.parse(plain);
  } catch {
    return {};
  }
}

function maskFields(fields: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, v.length > 8 ? `${v.slice(0, 4)}${'•'.repeat(8)}${v.slice(-4)}` : '••••••••'])
  );
}

export const credentialsService = {
  async list(userId: string) {
    const rows = await prisma.credential.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      appType: r.appType,
      fields: maskFields(decryptFields(r.fields as string)),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },

  async get(userId: string, id: string) {
    const row = await prisma.credential.findFirstOrThrow({ where: { id, userId } });
    return {
      id: row.id,
      name: row.name,
      appType: row.appType,
      fields: decryptFields(row.fields as string),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },

  async create(userId: string, data: { name: string; appType: string; fields: Record<string, string> }) {
    const enc = encryptFields(data.fields);
    const row = await prisma.credential.create({
      data: { userId, name: data.name, appType: data.appType, fields: enc },
    });
    return { id: row.id, name: row.name, appType: row.appType, fields: maskFields(data.fields), createdAt: row.createdAt, updatedAt: row.updatedAt };
  },

  async update(userId: string, id: string, data: { name?: string; fields?: Record<string, string> }) {
    const existing = await prisma.credential.findFirstOrThrow({ where: { id, userId } });
    const currentFields = decryptFields(existing.fields as string);
    const newFields = data.fields
      ? Object.fromEntries(Object.entries(data.fields).map(([k, v]) => [k, v || currentFields[k] || '']))
      : currentFields;
    const enc = encryptFields(newFields);
    const row = await prisma.credential.update({
      where: { id },
      data: { name: data.name ?? existing.name, fields: enc },
    });
    return { id: row.id, name: row.name, appType: row.appType, fields: maskFields(newFields), createdAt: row.createdAt, updatedAt: row.updatedAt };
  },

  async remove(userId: string, id: string) {
    await prisma.credential.findFirstOrThrow({ where: { id, userId } });
    await prisma.credential.delete({ where: { id } });
  },
};
