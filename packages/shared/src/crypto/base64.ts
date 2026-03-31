export const toBase64 = (input: Buffer | string): string => {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buffer.toString('base64');
};

export const fromBase64 = (value: string): Buffer => {
  return Buffer.from(value, 'base64');
};

export const utf8ToBuffer = (value: string): Buffer =>
  Buffer.from(value, 'utf8');
export const bufferToUtf8 = (value: Buffer): string => value.toString('utf8');
