import { z } from 'zod';

const blockPropertySchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'select', 'number', 'textarea', 'boolean']),
  value: z.any(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
});

const blockSchema = z.object({
  id: z.string(),
  definitionId: z.string(),
  category: z.enum(['trigger', 'logic', 'action', 'output']),
  label: z.string(),
  icon: z.string(),
  color: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  properties: z.array(blockPropertySchema),
});

const connectionSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
});

export const flowStatusSchema = z.enum(['active', 'inactive', 'draft']);

export const createFlowSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(500).default(''),
  blocks: z.array(blockSchema).default([]),
  connections: z.array(connectionSchema).default([]),
  status: flowStatusSchema.default('draft'),
});

export const updateFlowSchema = createFlowSchema.partial();

export const listFlowsQuerySchema = z.object({
  status: flowStatusSchema.optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  offset: z.coerce.number().min(0).optional(),
});

export type CreateFlowInput = z.infer<typeof createFlowSchema>;
export type UpdateFlowInput = z.infer<typeof updateFlowSchema>;
export type FlowBlockInput = z.infer<typeof blockSchema>;
export type FlowConnectionInput = z.infer<typeof connectionSchema>;
export type FlowStatus = z.infer<typeof flowStatusSchema>;
export type ListFlowsQuery = z.infer<typeof listFlowsQuerySchema>;
