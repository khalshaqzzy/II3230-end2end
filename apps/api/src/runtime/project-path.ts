import path from 'node:path';

const PROJECT_ROOT_SEGMENTS_UP = 3;

export const resolveProjectPath = (...segments: string[]) => {
  const [firstSegment] = segments;

  if (firstSegment && path.isAbsolute(firstSegment)) {
    return path.resolve(...segments);
  }

  return path.resolve(
    __dirname,
    ...Array(PROJECT_ROOT_SEGMENTS_UP).fill('..'),
    ...segments,
  );
};
