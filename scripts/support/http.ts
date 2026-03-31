export const fetchJson = async <T>(input: {
  url: string;
  method?: 'GET' | 'POST';
  body?: unknown;
}): Promise<T> => {
  const response = await fetch(input.url, {
    method: input.method ?? 'GET',
    headers: input.body
      ? {
          'content-type': 'application/json',
        }
      : undefined,
    body: input.body ? JSON.stringify(input.body) : undefined,
  });

  const responseBody = (await response.json()) as T;

  if (!response.ok) {
    throw new Error(
      `Request to ${input.url} failed with HTTP ${response.status}: ${JSON.stringify(responseBody)}`,
    );
  }

  return responseBody;
};
