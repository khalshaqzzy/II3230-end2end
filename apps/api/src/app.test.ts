import fs from 'node:fs';
import { createServer } from 'node:http';
import net from 'node:net';

import request from 'supertest';

import Database from 'better-sqlite3';

import { createTestHarness } from './test-support/fixtures';

const getAvailablePort = async () => {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        reject(new Error('Could not resolve an available port.'));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
    server.on('error', reject);
  });
};

describe('API routes', () => {
  it('returns 200 for /health', async () => {
    const harness = createTestHarness();

    try {
      const response = await request(harness.app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    } finally {
      harness.cleanup();
    }
  });

  it('returns 200 for /ready without leaking key paths', async () => {
    const harness = createTestHarness();

    try {
      const response = await request(harness.app).get('/ready');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ready');
      expect(response.body.identities.alice.logicalIp).toBe('10.10.0.2');
      expect(response.body.bobTargetBaseUrl).toBe('http://127.0.0.1:4000');
      expect(JSON.stringify(response.body)).not.toContain('private.pem');
    } finally {
      harness.cleanup();
    }
  });

  it('starts in Bob-only mode without Alice private key material', async () => {
    const harness = createTestHarness({
      envOverrides: {
        ALICE_PRIVATE_KEY_PATH: undefined,
      },
    });
    const { payload } = harness.createPayload();

    try {
      const createResponse = await request(harness.app).post('/messages').send({
        plaintext: 'Alice route should not be mounted in Bob-only mode.',
      });

      expect(createResponse.status).toBe(404);

      const processResponse = await request(harness.app)
        .post('/internal/messages/receive')
        .send(payload);

      expect(processResponse.status).toBe(200);
      expect(processResponse.body.verdict.accepted).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  it('processes a valid Bob payload and exposes persisted evidence', async () => {
    const harness = createTestHarness();
    const { payload, plaintext } = harness.createPayload();

    try {
      const processResponse = await request(harness.app)
        .post('/internal/messages/receive')
        .send(payload);

      expect(processResponse.status).toBe(200);
      expect(processResponse.body.status).toBe('processed');
      expect(processResponse.body.verdict.accepted).toBe(true);

      const listResponse = await request(harness.app).get('/messages');
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.messages).toHaveLength(1);
      expect(listResponse.body.messages[0].messageId).toBe(payload.messageId);
      expect(listResponse.body.messages[0].lifecycleState).toBe('processed');
      expect(listResponse.body.messages[0].verdict.reasonCode).toBe('accepted');

      const detailResponse = await request(harness.app).get(
        `/messages/${payload.messageId}`,
      );

      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.decryptedPlaintext).toBe(plaintext);
      expect(detailResponse.body.verdict.reasonCode).toBe('accepted');
      expect(detailResponse.body.lifecycleState).toBe('processed');
      expect(detailResponse.body.events[0].stage).toBe('receive_payload');
      expect(detailResponse.body.events.at(-1).stage).toBe('final_verdict');

      const serializedDetail = JSON.stringify(detailResponse.body);
      expect(serializedDetail).not.toContain('BEGIN PRIVATE KEY');
      expect(serializedDetail).not.toContain('private.pem');
    } finally {
      harness.cleanup();
    }
  });

  it('creates and sends a message through POST /messages', async () => {
    const port = await getAvailablePort();
    const harness = createTestHarness({
      envOverrides: {
        PORT: port,
        BOB_TARGET_BASE_URL: `http://127.0.0.1:${port}`,
      },
    });
    const server = createServer(harness.app);

    await new Promise<void>((resolve) => {
      server.listen(port, '127.0.0.1', () => resolve());
    });

    try {
      const createResponse = await request(harness.app).post('/messages').send({
        plaintext: 'Bob, ini pesan orchestration Alice.',
      });

      expect(createResponse.status).toBe(200);
      expect(createResponse.body.lifecycleState).toBe('processed');
      expect(createResponse.body.verdict.accepted).toBe(true);

      const detailResponse = await request(harness.app).get(
        `/messages/${createResponse.body.messageId}`,
      );

      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.lifecycleState).toBe('processed');
      expect(detailResponse.body.plaintext).toBe(
        'Bob, ini pesan orchestration Alice.',
      );
      expect(detailResponse.body.decryptedPlaintext).toBe(
        'Bob, ini pesan orchestration Alice.',
      );
      expect(
        detailResponse.body.events.some(
          (event: { actor: string; stage: string; status: string }) =>
            event.actor === 'alice' &&
            event.stage === 'send_payload' &&
            event.status === 'pending',
        ),
      ).toBe(true);
      expect(
        detailResponse.body.events.some(
          (event: { actor: string; stage: string; status: string }) =>
            event.actor === 'alice' &&
            event.stage === 'send_payload' &&
            event.status === 'success',
        ),
      ).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      harness.cleanup();
    }
  });

  it('rejects invalid payloads without creating a record', async () => {
    const harness = createTestHarness();

    try {
      const invalidResponse = await request(harness.app)
        .post('/internal/messages/receive')
        .send({
          messageId: 'invalid',
        });

      expect(invalidResponse.status).toBe(400);
      expect(invalidResponse.body.code).toBe('invalid_payload');

      const listResponse = await request(harness.app).get('/messages');
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.messages).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  it('rejects invalid POST /messages payloads without creating a record', async () => {
    const harness = createTestHarness();

    try {
      const invalidResponse = await request(harness.app)
        .post('/messages')
        .send({
          plaintext: '',
        });

      expect(invalidResponse.status).toBe(400);
      expect(invalidResponse.body.code).toBe('invalid_payload');

      const listResponse = await request(harness.app).get('/messages');
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.messages).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  it('stores send_failed lifecycle state when Bob is unreachable', async () => {
    const harness = createTestHarness({
      envOverrides: {
        BOB_TARGET_BASE_URL: 'http://127.0.0.1:9',
      },
    });

    try {
      const createResponse = await request(harness.app).post('/messages').send({
        plaintext: 'Bob, target ini tidak tersedia.',
      });

      expect(createResponse.status).toBe(200);
      expect(createResponse.body.lifecycleState).toBe('send_failed');
      expect(createResponse.body.verdict).toBeNull();
      expect(createResponse.body.transportFailure.code).toBe(
        'transport_request_failed',
      );

      const detailResponse = await request(harness.app).get(
        `/messages/${createResponse.body.messageId}`,
      );

      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.lifecycleState).toBe('send_failed');
      expect(detailResponse.body.verdict).toBeNull();
      expect(detailResponse.body.transportFailure.code).toBe(
        'transport_request_failed',
      );
    } finally {
      harness.cleanup();
    }
  });

  it('orders message summaries by processedAt descending with lifecycle records', async () => {
    const harness = createTestHarness({
      envOverrides: {
        BOB_TARGET_BASE_URL: 'http://127.0.0.1:9',
      },
    });
    const first = harness.createPayload({
      messageId: 'msg-001',
    });

    try {
      await request(harness.app)
        .post('/internal/messages/receive')
        .send(first.payload);
      await new Promise((resolve) => setTimeout(resolve, 15));
      await request(harness.app).post('/messages').send({
        plaintext: 'Bob, pesan gagal kirim belakangan.',
      });

      const listResponse = await request(harness.app).get('/messages');

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.messages[0].lifecycleState).toBe('send_failed');
      expect(listResponse.body.messages.at(-1).messageId).toBe('msg-001');
    } finally {
      harness.cleanup();
    }
  });

  it('bootstraps migrations idempotently in the configured data directory', () => {
    const harness = createTestHarness();

    try {
      expect(fs.existsSync(harness.dbPath)).toBe(true);

      harness.runtime.close();
      const sqlite = new Database(harness.dbPath);
      const rows = sqlite
        .prepare(
          "select name from sqlite_master where type = 'table' and name in ('messages', 'message_events') order by name",
        )
        .all() as { name: string }[];
      const columns = sqlite.prepare("pragma table_info('messages')").all() as {
        name: string;
      }[];
      sqlite.close();

      expect(rows.map((row) => row.name)).toEqual([
        'message_events',
        'messages',
      ]);
      expect(columns.map((column) => column.name)).toContain('lifecycle_state');
      expect(columns.map((column) => column.name)).toContain(
        'transport_failure_code',
      );
    } finally {
      harness.cleanup();
    }
  });
});
