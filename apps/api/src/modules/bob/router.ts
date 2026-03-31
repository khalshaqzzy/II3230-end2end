import { Router } from 'express';
import { ZodError } from 'zod';

import { messagePayloadSchema } from '@ii3230/shared';

import type { BobService } from './service';

export const createBobRouter = (input: { bobService: BobService }) => {
  const router = Router();

  router.post('/internal/messages/receive', (request, response) => {
    const parsedPayload = messagePayloadSchema.safeParse(request.body);

    if (!parsedPayload.success) {
      response.status(400).json({
        status: 'error',
        code: 'invalid_payload',
        issues: parsedPayload.error.issues,
      });
      return;
    }

    const result = input.bobService.processPayload(parsedPayload.data);

    response.status(200).json({
      status: 'processed',
      messageId: result.messageId,
      verdict: result.verdict,
    });
  });

  return router;
};
