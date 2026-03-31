import pino, { type Logger } from 'pino';

import type { AppEnv } from '@ii3230/shared';

export const createLogger = (env: AppEnv): Logger => {
  return pino({
    level: env.LOG_LEVEL,
    base: {
      service: 'ii3230-api',
      environment: env.APP_ENV,
    },
  });
};
