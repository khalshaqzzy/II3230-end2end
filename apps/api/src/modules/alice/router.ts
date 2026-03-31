import { Router } from 'express';

import { createMessageRequestSchema } from '@ii3230/shared';

import type { MessageCommandService } from './orchestrator';

export const createAliceRouter = (input: {
  messageCommandService: MessageCommandService;
}) => {
  const router = Router();

  router.post('/messages', async (request, response, next) => {
    const parsedRequest = createMessageRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      response.status(400).json({
        status: 'error',
        code: 'invalid_payload',
        issues: parsedRequest.error.issues,
      });
      return;
    }

    try {
      const result = await input.messageCommandService.createAndSendMessage(
        parsedRequest.data,
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
};
