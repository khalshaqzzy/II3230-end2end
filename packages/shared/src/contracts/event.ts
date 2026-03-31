import { z } from 'zod';

import {
  actorSchema,
  messageEventStatusSchema,
  messageStageSchema,
} from './stages';

export const messageEventSchema = z.object({
  messageId: z.string().min(1),
  actor: actorSchema,
  stage: messageStageSchema,
  status: messageEventStatusSchema,
  summary: z.string().min(1),
  details: z.record(z.string(), z.unknown()).default({}),
  timestamp: z.string().datetime({ offset: true }),
});
export type MessageEvent = z.infer<typeof messageEventSchema>;
