import { z } from 'zod';

export const createCredentialSchema = z.object({
  name: z.string().min(1).max(100),
  appType: z.string().min(1).max(50),
  fields: z.record(z.string()),
});

export const updateCredentialSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  fields: z.record(z.string()).optional(),
});
