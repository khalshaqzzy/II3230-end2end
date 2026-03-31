import { createServer } from 'node:http';

import { createApp } from './app';
import { env } from './config/env';
import { createLogger } from './logger';

const logger = createLogger(env);
const app = createApp({ env, logger });
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
