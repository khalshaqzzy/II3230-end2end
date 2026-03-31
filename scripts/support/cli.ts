import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import type { AppEnv } from '@ii3230/shared';
import { parseAppEnv, sanitizeArtifactDetails } from '@ii3230/shared';

const dotenvPattern =
  /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(.*))\s*$/;

const parseDotenvFile = (filePath: string): Record<string, string> => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  return Object.fromEntries(
    lines
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .flatMap((line) => {
        const match = dotenvPattern.exec(line);

        if (!match) {
          return [];
        }

        const [, key, doubleQuoted, singleQuoted, rawValue] = match;
        return [[key, doubleQuoted ?? singleQuoted ?? (rawValue ?? '').trim()]];
      }),
  );
};

const defaultPort = '4000';
const defaultKeyBaseDir = '.local/data/keys';

const resolveDotenvPath = (filePath: string) => {
  return path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
};

export const loadScriptEnv = (input?: { envFile?: string }): AppEnv => {
  const envFile = parseDotenvFile(resolveDotenvPath('.env'));
  const envLocal = parseDotenvFile(resolveDotenvPath('.env.local'));
  const explicitEnvFile = input?.envFile
    ? parseDotenvFile(resolveDotenvPath(input.envFile))
    : {};

  return parseAppEnv({
    ...envFile,
    ...envLocal,
    ...explicitEnvFile,
    PORT:
      process.env.PORT ??
      explicitEnvFile.PORT ??
      envLocal.PORT ??
      envFile.PORT ??
      defaultPort,
    LOG_LEVEL:
      process.env.LOG_LEVEL ??
      explicitEnvFile.LOG_LEVEL ??
      envLocal.LOG_LEVEL ??
      envFile.LOG_LEVEL ??
      'info',
    APP_ENV:
      process.env.APP_ENV ??
      explicitEnvFile.APP_ENV ??
      envLocal.APP_ENV ??
      envFile.APP_ENV ??
      'development',
    APP_DATA_DIR:
      process.env.APP_DATA_DIR ??
      explicitEnvFile.APP_DATA_DIR ??
      envLocal.APP_DATA_DIR ??
      envFile.APP_DATA_DIR ??
      '.local/data',
    ALICE_LOGICAL_IP:
      process.env.ALICE_LOGICAL_IP ??
      explicitEnvFile.ALICE_LOGICAL_IP ??
      envLocal.ALICE_LOGICAL_IP ??
      envFile.ALICE_LOGICAL_IP ??
      '10.10.0.2',
    BOB_LOGICAL_IP:
      process.env.BOB_LOGICAL_IP ??
      explicitEnvFile.BOB_LOGICAL_IP ??
      envLocal.BOB_LOGICAL_IP ??
      envFile.BOB_LOGICAL_IP ??
      '10.10.0.3',
    ALICE_PRIVATE_KEY_PATH:
      process.env.ALICE_PRIVATE_KEY_PATH ??
      explicitEnvFile.ALICE_PRIVATE_KEY_PATH ??
      envLocal.ALICE_PRIVATE_KEY_PATH ??
      envFile.ALICE_PRIVATE_KEY_PATH ??
      `${defaultKeyBaseDir}/alice/private.pem`,
    ALICE_PUBLIC_KEY_PATH:
      process.env.ALICE_PUBLIC_KEY_PATH ??
      explicitEnvFile.ALICE_PUBLIC_KEY_PATH ??
      envLocal.ALICE_PUBLIC_KEY_PATH ??
      envFile.ALICE_PUBLIC_KEY_PATH ??
      `${defaultKeyBaseDir}/alice/public.pem`,
    BOB_PRIVATE_KEY_PATH:
      process.env.BOB_PRIVATE_KEY_PATH ??
      explicitEnvFile.BOB_PRIVATE_KEY_PATH ??
      envLocal.BOB_PRIVATE_KEY_PATH ??
      envFile.BOB_PRIVATE_KEY_PATH ??
      `${defaultKeyBaseDir}/bob/private.pem`,
    BOB_PUBLIC_KEY_PATH:
      process.env.BOB_PUBLIC_KEY_PATH ??
      explicitEnvFile.BOB_PUBLIC_KEY_PATH ??
      envLocal.BOB_PUBLIC_KEY_PATH ??
      envFile.BOB_PUBLIC_KEY_PATH ??
      `${defaultKeyBaseDir}/bob/public.pem`,
    BOB_TARGET_BASE_URL:
      process.env.BOB_TARGET_BASE_URL ??
      explicitEnvFile.BOB_TARGET_BASE_URL ??
      envLocal.BOB_TARGET_BASE_URL ??
      envFile.BOB_TARGET_BASE_URL,
  });
};

export const resolveTargetBaseUrl = (
  target: string | undefined,
  env: AppEnv,
) => {
  return (target ?? `http://127.0.0.1:${env.PORT}`).replace(/\/+$/, '');
};

export const writeJsonOutput = (
  outputPath: string | undefined,
  value: unknown,
) => {
  if (!outputPath) {
    return;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(sanitizeArtifactDetails(value), null, 2),
    'utf8',
  );
};

export const printJson = (value: unknown) => {
  process.stdout.write(
    `${JSON.stringify(sanitizeArtifactDetails(value), null, 2)}\n`,
  );
};

export const tryOpenUrl = async (url: string) => {
  const openCommand =
    process.platform === 'win32'
      ? {
          command: 'cmd',
          args: ['/c', 'start', '', url],
        }
      : process.platform === 'darwin'
        ? {
            command: 'open',
            args: [url],
          }
        : {
            command: 'xdg-open',
            args: [url],
          };

  await new Promise<void>((resolve) => {
    const child = spawn(openCommand.command, openCommand.args, {
      stdio: 'ignore',
      detached: true,
    });

    child.on('error', () => resolve());
    child.unref();
    resolve();
  });
};
