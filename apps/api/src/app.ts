import express from 'express';

import type { AppEnv } from '@ii3230/shared';
import type { Logger } from 'pino';

import { createAliceRouter } from './modules/alice/router';
import { createBobRouter } from './modules/bob/router';
import { createMessagesRouter } from './modules/messages/router';
import type { AppRuntime } from './runtime/create-app-runtime';

export const createApp = (input: {
  env: AppEnv;
  logger: Logger;
  runtime: AppRuntime;
}) => {
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
      bobTargetBaseUrl:
        input.env.BOB_TARGET_BASE_URL ?? `http://127.0.0.1:${input.env.PORT}`,
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
    createAliceRouter({
      messageCommandService: input.runtime.messageCommandService,
    }),
  );
  app.use(createBobRouter({ bobService: input.runtime.bobService }));
  app.use(
    createMessagesRouter({
      messageQueryService: input.runtime.messageQueryService,
    }),
  );

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof SyntaxError && 'body' in error) {
        response.status(400).json({
          status: 'error',
          code: 'invalid_payload',
          issues: [
            {
              code: 'invalid_json',
              message: 'Request body must be valid JSON.',
            },
          ],
        });
        return;
      }

      input.logger.error({ err: error }, 'Unhandled request error');

      response.status(500).json({
        status: 'error',
        code: 'internal_error',
      });
    },
  );

  return app;
};
