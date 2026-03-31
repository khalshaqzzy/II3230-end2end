import { parseArgs } from 'node:util';

import { loadScriptEnv } from './support/cli';

const { values } = parseArgs({
  options: {
    'env-file': {
      type: 'string',
    },
  },
});

const main = async () => {
  const env = loadScriptEnv({ envFile: values['env-file'] });

  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      process.env[key] = String(value);
    }
  }

  await import('../apps/api/src/server');
};

void main().catch((error) => {
  throw error;
});
