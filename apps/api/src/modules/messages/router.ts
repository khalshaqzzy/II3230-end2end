import { Router } from 'express';

import type { MessageQueryService } from './service';

export const createMessagesRouter = (input: {
  messageQueryService: MessageQueryService;
}) => {
  const router = Router();

  router.get('/messages', (_request, response) => {
    response.status(200).json(input.messageQueryService.listMessages());
  });

  router.get('/messages/:messageId', (request, response) => {
    const detail = input.messageQueryService.getMessageDetail(
      request.params.messageId,
    );

    if (!detail) {
      response.status(404).json({
        status: 'error',
        code: 'message_not_found',
      });
      return;
    }

    response.status(200).json(detail);
  });

  return router;
};
