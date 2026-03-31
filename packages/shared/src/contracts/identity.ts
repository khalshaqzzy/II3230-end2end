import { z } from 'zod';

export const actorIdentitySchema = z.enum(['alice', 'bob']);
export type ActorIdentity = z.infer<typeof actorIdentitySchema>;

export const identityConfigSchema = z.object({
  actorId: actorIdentitySchema,
  logicalIp: z.string().min(1),
  privateKeyPath: z.string().min(1),
  publicKeyPath: z.string().min(1),
});
export type IdentityConfig = z.infer<typeof identityConfigSchema>;
