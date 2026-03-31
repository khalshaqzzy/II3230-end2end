import {
  type MessagePayload,
  signatureInputVersionSchema,
} from '../contracts/message';

export interface CanonicalSignaturePayloadInput {
  messageId: MessagePayload['messageId'];
  senderId: MessagePayload['senderId'];
  recipientId: MessagePayload['recipientId'];
  sourceIp: MessagePayload['sourceIp'];
  destinationIp: MessagePayload['destinationIp'];
  timestamp: MessagePayload['timestamp'];
  algorithms: MessagePayload['algorithms'];
  ivB64: MessagePayload['ivB64'];
  authTagB64: MessagePayload['authTagB64'];
  ciphertextB64: MessagePayload['ciphertextB64'];
  encryptedSymmetricKeyB64: MessagePayload['encryptedSymmetricKeyB64'];
  plaintextHashHex: MessagePayload['plaintextHashHex'];
  signatureInputVersion: MessagePayload['signatureInputVersion'];
}

export const SIGNATURE_INPUT_VERSION = signatureInputVersionSchema.value;

export const buildCanonicalSignatureInput = (
  input: CanonicalSignaturePayloadInput,
): Buffer => {
  const orderedPayload = {
    signatureInputVersion: input.signatureInputVersion,
    messageId: input.messageId,
    senderId: input.senderId,
    recipientId: input.recipientId,
    sourceIp: input.sourceIp,
    destinationIp: input.destinationIp,
    timestamp: input.timestamp,
    algorithms: input.algorithms,
    ivB64: input.ivB64,
    authTagB64: input.authTagB64,
    ciphertextB64: input.ciphertextB64,
    encryptedSymmetricKeyB64: input.encryptedSymmetricKeyB64,
    plaintextHashHex: input.plaintextHashHex,
  };

  return Buffer.from(JSON.stringify(orderedPayload), 'utf8');
};
