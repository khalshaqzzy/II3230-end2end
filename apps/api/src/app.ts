import express from 'express';

import type { AppEnv } from '@ii3230/shared';
import type { Logger } from 'pino';

export const createApp = (input: { env: AppEnv; logger: Logger }) => {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.status(200).json({
      status: 'ok',
      service: 'ii3230-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', (_request, response) => {
    response.status(200).json({
      status: 'ready',
      appEnv: input.env.APP_ENV,
      port: input.env.PORT,
      dataDir: input.env.APP_DATA_DIR,
      identities: {
        alice: {
          logicalIp: input.env.ALICE_LOGICAL_IP,
        },
        bob: {
          logicalIp: input.env.BOB_LOGICAL_IP,
        },
      },
    });
  });

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      input.logger.error({ err: error }, 'Unhandled request error');

      response.status(500).json({
        status: 'error',
        code: 'internal_error',
      });
    },
  );

  return app;
};
