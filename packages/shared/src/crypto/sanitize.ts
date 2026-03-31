import { maskEducationalSecret } from './mask';

const PRIVATE_KEY_MARKER = '-----BEGIN PRIVATE KEY-----';
const PRIVATE_KEY_FIELD_PATTERN =
  /(privatekey|private_key|privatepem|private_pem|privatekeypath|private_key_path)/i;
const RAW_SECRET_FIELD_PATTERN =
  /(symmetrickey|symmetric_key|rawkey|raw_key|plaintextkey|plaintext_key)/i;

const redactString = (key: string, value: string): string => {
  if (PRIVATE_KEY_FIELD_PATTERN.test(key)) {
    return '[REDACTED_PRIVATE_KEY]';
  }
  if (value.includes(PRIVATE_KEY_MARKER)) {
    return '[REDACTED_PRIVATE_KEY]';
  }
  if (RAW_SECRET_FIELD_PATTERN.test(key)) {
    return maskEducationalSecret(value);
  }
  return value;
};

export const sanitizeArtifactDetails = (value: unknown, key = ''): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeArtifactDetails(item, key));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeArtifactDetails(entryValue, entryKey),
      ]),
    );
  }

  if (typeof value === 'string') {
    return redactString(key, value);
  }

  return value;
};
