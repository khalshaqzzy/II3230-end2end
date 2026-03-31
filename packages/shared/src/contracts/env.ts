import { z } from 'zod';

const parseNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return Number(value);
  }
  return value;
};

export const appEnvSchema = z.object({
  PORT: z.preprocess(parseNumber, z.number().int().min(1).max(65535)),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
  APP_ENV: z.enum(['development', 'test', 'production']),
  APP_DATA_DIR: z.string().min(1),
  ALICE_LOGICAL_IP: z.string().min(1),
  BOB_LOGICAL_IP: z.string().min(1),
  ALICE_PRIVATE_KEY_PATH: z.string().min(1),
  ALICE_PUBLIC_KEY_PATH: z.string().min(1),
  BOB_PRIVATE_KEY_PATH: z.string().min(1),
  BOB_PUBLIC_KEY_PATH: z.string().min(1),
  BOB_TARGET_BASE_URL: z.string().url().optional(),
});
export type AppEnv = z.infer<typeof appEnvSchema>;

export const parseAppEnv = (env: NodeJS.ProcessEnv): AppEnv => {
  return appEnvSchema.parse(env);
};
