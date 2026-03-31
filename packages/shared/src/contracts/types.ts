import type { VerificationVerdict } from './verdict';

export const hasVerificationVerdict = (
  verdict: VerificationVerdict | null | undefined,
): verdict is VerificationVerdict => {
  return verdict != null;
};
