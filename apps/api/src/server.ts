import { createServer } from 'node:http';

import { createApp } from './app';
import { env } from './config/env';
import { createLogger } from './logger';
import { createAppRuntime } from './runtime/create-app-runtime';

const logger = createLogger(env);
const runtime = createAppRuntime({ env, logger });
const app = createApp({ env, logger, runtime });
const server = createServer(app);

server.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      appEnv: env.APP_ENV,
      dataDir: env.APP_DATA_DIR,
    },
    'API listening',
  );
});

const shutdown = () => {
  runtime.close();
  server.close(() => {
    process.exit(0);
  });
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
