import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const actors = ['alice', 'bob'] as const;
const baseDir = process.argv[2] ?? '.local/data/keys';

for (const actor of actors) {
  const actorDir = join(baseDir, actor);
  mkdirSync(actorDir, { recursive: true });

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  const privateKeyPath = join(actorDir, 'private.pem');
  const publicKeyPath = join(actorDir, 'public.pem');

  mkdirSync(dirname(privateKeyPath), { recursive: true });
  writeFileSync(privateKeyPath, privateKey, { encoding: 'utf8' });
  writeFileSync(publicKeyPath, publicKey, { encoding: 'utf8' });
}

process.stdout.write(`Generated local RSA keypairs under ${baseDir}\n`);
