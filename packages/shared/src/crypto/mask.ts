export interface MaskOptions {
  prefixLength?: number;
  suffixLength?: number;
  maskCharacter?: string;
}

export const maskEducationalSecret = (
  value: string,
  options: MaskOptions = {},
): string => {
  const prefixLength = options.prefixLength ?? 6;
  const suffixLength = options.suffixLength ?? 4;
  const maskCharacter = options.maskCharacter ?? '*';

  if (value.length <= prefixLength + suffixLength) {
    return maskCharacter.repeat(Math.max(8, value.length));
  }

  const maskedLength = value.length - prefixLength - suffixLength;
  return `${value.slice(0, prefixLength)}${maskCharacter.repeat(maskedLength)}${value.slice(-suffixLength)}`;
};
