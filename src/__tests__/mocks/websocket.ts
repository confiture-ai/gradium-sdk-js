/**
 * Mock WebSocket for testing TTS and STT streaming
 */
export class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  protocol = "";
  binaryType: "blob" | "arraybuffer" = "blob";

  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  private sentMessages: string[] = [];
  private messageQueue: string[] = [];

  constructor(url: string, _options?: unknown) {
    this.url = url;
  }

  /**
   * Simulate connection opening (call from tests)
   */
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event("open"));
    }
  }

  /**
   * Simulate receiving a message (call from tests)
   */
  simulateMessage(data: string | object): void {
    const messageData = typeof data === "string" ? data : JSON.stringify(data);
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data: messageData }));
    }
  }

  /**
   * Simulate connection close (call from tests)
   */
  simulateClose(code = 1000, reason = "", wasClean = true): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason, wasClean } as CloseEvent);
    }
  }

  /**
   * Simulate an error (call from tests)
   */
  simulateError(): void {
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }

  send(data: string): void {
    this.sentMessages.push(data);
    this.messageQueue.push(data);
  }

  close(_code?: number, _reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
  }

  /**
   * Get all messages sent through this WebSocket
   */
  getSentMessages(): string[] {
    return [...this.sentMessages];
  }

  /**
   * Get last sent message
   */
  getLastSentMessage(): string | undefined {
    return this.sentMessages.at(-1);
  }

  /**
   * Get last sent message as parsed JSON
   */
  getLastSentJSON<T = unknown>(): T | undefined {
    const msg = this.getLastSentMessage();
    return msg ? JSON.parse(msg) : undefined;
  }

  /**
   * Clear sent messages
   */
  clearSentMessages(): void {
    this.sentMessages = [];
    this.messageQueue = [];
  }

  // Static instance tracking for tests
  private static instances: MockWebSocket[] = [];

  static getLastInstance(): MockWebSocket | undefined {
    return MockWebSocket.instances.at(-1);
  }

  static clearInstances(): void {
    MockWebSocket.instances = [];
  }

  static trackInstance(instance: MockWebSocket): void {
    MockWebSocket.instances.push(instance);
  }
}

/**
 * Create a mock WebSocket constructor that tracks instances
 */
export function createMockWebSocketConstructor(): typeof MockWebSocket {
  return class TrackedMockWebSocket extends MockWebSocket {
    constructor(url: string, options?: unknown) {
      super(url, options);
      MockWebSocket.trackInstance(this);
    }
  };
}
