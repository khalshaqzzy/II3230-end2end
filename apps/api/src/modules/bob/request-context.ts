import type { Request } from 'express';

export interface BobRequestContext {
  actualRequesterIp: string | null;
  remoteAddress: string | null;
  forwardedFor: string | null;
  userAgent: string | null;
  validationMode: string | null;
  testRunId: string | null;
  scenario: string | null;
}

const readHeader = (request: Request, headerName: string) => {
  const value = request.header(headerName);
  return value && value.trim().length > 0 ? value : null;
};

export const createBobRequestContext = (request: Request): BobRequestContext => {
  return {
    actualRequesterIp: request.ip ?? null,
    remoteAddress: request.socket.remoteAddress ?? null,
    forwardedFor: readHeader(request, 'x-forwarded-for'),
    userAgent: readHeader(request, 'user-agent'),
    validationMode: readHeader(request, 'x-ii3230-validation-mode'),
    testRunId: readHeader(request, 'x-ii3230-test-run-id'),
    scenario: readHeader(request, 'x-ii3230-scenario'),
  };
};
