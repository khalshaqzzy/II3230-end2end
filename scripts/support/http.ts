export const fetchJson = async <T>(input: {
  url: string;
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string | undefined>;
}): Promise<T> => {
  const headers = {
    ...(input.body
      ? {
          'content-type': 'application/json',
        }
      : {}),
    ...Object.fromEntries(
      Object.entries(input.headers ?? {}).filter(([, value]) => value !== undefined),
    ),
  };

  const response = await fetch(input.url, {
    method: input.method ?? 'GET',
    headers: Object.keys(headers).length > 0 ? headers : undefined,
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
