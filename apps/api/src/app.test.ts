import fs from 'node:fs';

import request from 'supertest';

import Database from 'better-sqlite3';

import { createTestHarness } from './test-support/fixtures';

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
      expect(JSON.stringify(response.body)).not.toContain('private.pem');
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

      const detailResponse = await request(harness.app).get(
        `/messages/${payload.messageId}`,
      );

      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.decryptedPlaintext).toBe(plaintext);
      expect(detailResponse.body.verdict.reasonCode).toBe('accepted');
      expect(detailResponse.body.events[0].stage).toBe('receive_payload');
      expect(detailResponse.body.events.at(-1).stage).toBe('final_verdict');

      const serializedDetail = JSON.stringify(detailResponse.body);
      expect(serializedDetail).not.toContain('BEGIN PRIVATE KEY');
      expect(serializedDetail).not.toContain('private.pem');
    } finally {
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

  it('orders message summaries by processedAt descending', async () => {
    const harness = createTestHarness();
    const first = harness.createPayload({
      messageId: 'msg-001',
    });
    const second = harness.createPayload({
      messageId: 'msg-002',
    });

    try {
      await request(harness.app)
        .post('/internal/messages/receive')
        .send(first.payload);
      await new Promise((resolve) => setTimeout(resolve, 15));
      await request(harness.app)
        .post('/internal/messages/receive')
        .send(second.payload);

      const listResponse = await request(harness.app).get('/messages');

      expect(listResponse.status).toBe(200);
      expect(
        listResponse.body.messages.map(
          (item: { messageId: string }) => item.messageId,
        ),
      ).toEqual(['msg-002', 'msg-001']);
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
      sqlite.close();

      expect(rows.map((row) => row.name)).toEqual([
        'message_events',
        'messages',
      ]);

      const secondRuntimeHarness = createTestHarness();
      secondRuntimeHarness.cleanup();
    } finally {
      harness.cleanup();
    }
  });
});
