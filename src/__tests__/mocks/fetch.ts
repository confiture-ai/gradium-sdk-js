/**
 * Mock fetch responses for testing REST API calls
 */

export type MockResponseInit = {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

/**
 * Create a mock Response object
 */
export function createMockResponse(init: MockResponseInit = {}): Response {
  const { status = 200, statusText = "OK", headers = {}, body = {} } = init;

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: new Headers(headers),
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    blob: async () => new Blob([JSON.stringify(body)]),
    arrayBuffer: async () =>
      new TextEncoder().encode(JSON.stringify(body)).buffer,
    clone: () => createMockResponse(init),
    body: null,
    bodyUsed: false,
    redirected: false,
    type: "basic" as ResponseType,
    url: "",
    formData: async () => new FormData(),
    bytes: async () => new Uint8Array(),
  } as Response;
}

/**
 * Mock fetch function type
 */
export type MockFetch = ((
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>) & {
  mockResolvedValueOnceWithResponse: (init: MockResponseInit) => void;
  calls: Array<{ url: string; init?: RequestInit }>;
};

/**
 * Mock fetch function factory
 */
export function createMockFetch(defaultResponse?: MockResponseInit): MockFetch {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  const mockFn = (async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url = input.toString();
    calls.push({ url, init });
    return createMockResponse(defaultResponse);
  }) as MockFetch;

  mockFn.calls = calls;

  mockFn.mockResolvedValueOnceWithResponse = (init: MockResponseInit) => {
    const originalImpl = mockFn;
    let called = false;

    const newMockFn = async (
      input: RequestInfo | URL,
      reqInit?: RequestInit
    ): Promise<Response> => {
      const url = input.toString();
      calls.push({ url, init: reqInit });

      if (!called) {
        called = true;
        return createMockResponse(init);
      }
      return originalImpl(input, reqInit);
    };

    Object.assign(mockFn, newMockFn);
  };

  return mockFn;
}

/**
 * Setup mock fetch with multiple responses in sequence
 */
export function setupMockFetch(
  responses: MockResponseInit[]
): typeof globalThis.fetch {
  let callIndex = 0;

  return (async (
    _input: RequestInfo | URL,
    _init?: RequestInit
  ): Promise<Response> => {
    const response = responses[callIndex] ?? responses.at(-1);
    callIndex++;
    return createMockResponse(response);
  }) as typeof fetch;
}
