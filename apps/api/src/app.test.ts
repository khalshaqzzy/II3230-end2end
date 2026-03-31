import request from 'supertest';

import { parseAppEnv } from '@ii3230/shared';

import { createApp } from './app';
import { createLogger } from './logger';

describe('API bootstrap routes', () => {
  const env = parseAppEnv({
    PORT: '4000',
    LOG_LEVEL: 'info',
    APP_ENV: 'test',
    APP_DATA_DIR: '.local/data',
    ALICE_LOGICAL_IP: '10.10.0.2',
    BOB_LOGICAL_IP: '10.10.0.3',
    ALICE_PRIVATE_KEY_PATH: '.local/keys/alice/private.pem',
    ALICE_PUBLIC_KEY_PATH: '.local/keys/alice/public.pem',
    BOB_PRIVATE_KEY_PATH: '.local/keys/bob/private.pem',
    BOB_PUBLIC_KEY_PATH: '.local/keys/bob/public.pem',
  });

  const app = createApp({ env, logger: createLogger(env) });

  it('returns 200 for /health', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('returns 200 for /ready without leaking key paths', async () => {
    const response = await request(app).get('/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
    expect(response.body.identities.alice.logicalIp).toBe('10.10.0.2');
    expect(JSON.stringify(response.body)).not.toContain('private.pem');
  });
});
