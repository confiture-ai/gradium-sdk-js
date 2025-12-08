import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Gradium } from "../../client";
import { WebSocketError } from "../../errors";
import { TTSStream } from "../../resources/tts";
import {
  createMockWebSocketConstructor,
  MockWebSocket,
} from "../mocks/websocket";

describe("TTS Resource", () => {
  let client: Gradium;
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    client = new Gradium({ apiKey: "test-api-key" });
    originalWebSocket = globalThis.WebSocket;
    MockWebSocket.clearInstances();
    globalThis.WebSocket = createMockWebSocketConstructor() as any;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  describe("TTSStream", () => {
    it("should handle ready message", async () => {
      const mockWs = new MockWebSocket("wss://test");
      const stream = new TTSStream(mockWs as any);

      // Simulate ready message
      mockWs.simulateMessage({
        type: "ready",
        request_id: "req-123",
      });

      await stream.waitReady();
      expect(stream.getRequestId()).toBe("req-123");
    });

    it("should throw error when sending text before ready", () => {
      const mockWs = new MockWebSocket("wss://test");
      const stream = new TTSStream(mockWs as any);

      expect(() => stream.sendText("Hello")).toThrow(WebSocketError);
      expect(() => stream.sendText("Hello")).toThrow(
        "Stream is not ready. Call waitReady() first."
      );
    });

    it("should send text correctly", async () => {
      const mockWs = new MockWebSocket("wss://test");
      const stream = new TTSStream(mockWs as any);

      mockWs.simulateMessage({
        type: "ready",
        request_id: "req-123",
      });

      await stream.waitReady();
      stream.sendText("Hello, world!");

      const sentMessage = mockWs.getLastSentJSON<{
        type: string;
        text: string;
      }>();
      expect(sentMessage).toEqual({
        type: "text",
        text: "Hello, world!",
      });
    });

    it("should send end of stream", async () => {
      const mockWs = new MockWebSocket("wss://test");
      const stream = new TTSStream(mockWs as any);

      mockWs.simulateMessage({
        type: "ready",
        request_id: "req-123",
      });

      await stream.waitReady();
      stream.sendEndOfStream();

      const sentMessage = mockWs.getLastSentJSON<{ type: string }>();
      expect(sentMessage).toEqual({ type: "end_of_stream" });
    });

    it("should collect audio chunks", async () => {
      const mockWs = new MockWebSocket("wss://test");
      const stream = new TTSStream(mockWs as any);

      mockWs.simulateMessage({
        type: "ready",
        request_id: "req-123",
      });

      // Simulate audio chunks (base64 encoded)
      const chunk1 = new Uint8Array([1, 2, 3]);
      const chunk2 = new Uint8Array([4, 5, 6]);

      mockWs.simulateMessage({
        type: "audio",
        audio: btoa(String.fromCharCode(...chunk1)),
      });

      mockWs.simulateMessage({
        type: "audio",
        audio: btoa(String.fromCharCode(...chunk2)),
      });

      mockWs.simulateMessage({ type: "end_of_stream" });

      const result = await stream.collect();

      expect(result.request_id).toBe("req-123");
      expect(result.sample_rate).toBe(48_000);
      expect(result.raw_data).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
    });

    it("should be directly iterable with for-await-of", async () => {
      const mockWs = new MockWebSocket("wss://test");
      const stream = new TTSStream(mockWs as any);

      mockWs.simulateMessage({
        type: "ready",
        request_id: "req-123",
      });

      // Simulate audio chunks
      const chunk1 = new Uint8Array([1, 2, 3]);
      const chunk2 = new Uint8Array([4, 5, 6]);

      // Send audio in background
      setTimeout(() => {
        mockWs.simulateMessage({
          type: "audio",
          audio: btoa(String.fromCharCode(...chunk1)),
        });
      }, 10);

      setTimeout(() => {
        mockWs.simulateMessage({
          type: "audio",
          audio: btoa(String.fromCharCode(...chunk2)),
        });
      }, 20);

      setTimeout(() => {
        mockWs.simulateMessage({ type: "end_of_stream" });
      }, 30);

      const chunks: Uint8Array[] = [];
      // Direct iteration using Symbol.asyncIterator
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual(chunk1);
      expect(chunks[1]).toEqual(chunk2);
    });

    it("should handle error messages", async () => {
      const mockWs = new MockWebSocket("wss://test");
      const stream = new TTSStream(mockWs as any);

      mockWs.simulateMessage({
        type: "error",
        message: "Voice not found",
        code: 404,
      });

      // Both promises should reject with the same error
      const [readyResult, collectResult] = await Promise.allSettled([
        stream.waitReady(),
        stream.collect(),
      ]);

      expect(readyResult.status).toBe("rejected");
      expect(collectResult.status).toBe("rejected");

      if (readyResult.status === "rejected") {
        expect(readyResult.reason).toBeInstanceOf(WebSocketError);
        expect(readyResult.reason.message).toBe("Voice not found");
      }
    });

    it("should close the WebSocket", async () => {
      const mockWs = new MockWebSocket("wss://test");
      const stream = new TTSStream(mockWs as any);

      stream.close();
      expect(mockWs.readyState).toBe(MockWebSocket.CLOSED);
    });
  });

  describe("TTS.stream", () => {
    it("should create a TTS stream and send setup message", async () => {
      const streamPromise = client.tts.stream({
        voice_id: "test-voice",
        output_format: "wav",
        model_name: "default",
      });

      // Get the mock WebSocket instance
      const mockWs = MockWebSocket.getLastInstance();
      expect(mockWs).toBeDefined();

      // Simulate WebSocket open
      mockWs?.simulateOpen();

      const stream = await streamPromise;
      expect(stream).toBeInstanceOf(TTSStream);

      // Verify setup message was sent
      const setupMessage = mockWs?.getLastSentJSON<{
        type: string;
        voice_id: string;
        output_format: string;
        model_name: string;
      }>();

      expect(setupMessage).toEqual({
        type: "setup",
        voice_id: "test-voice",
        output_format: "wav",
        model_name: "default",
      });
    });

    it("should include json_config in setup when provided", async () => {
      const streamPromise = client.tts.stream({
        voice_id: "test-voice",
        output_format: "pcm",
        json_config: { padding_bonus: -2.0 },
      });

      const mockWs = MockWebSocket.getLastInstance();
      mockWs?.simulateOpen();

      await streamPromise;

      const setupMessage = mockWs?.getLastSentJSON<{
        json_config?: { padding_bonus: number };
      }>();

      expect(setupMessage?.json_config).toEqual({ padding_bonus: -2.0 });
    });
  });

  describe("TTS.create", () => {
    it("should create non-streaming TTS and return complete audio", async () => {
      const createPromise = client.tts.create({
        voice_id: "test-voice",
        output_format: "wav",
        text: "Hello, world!",
      });

      const mockWs = MockWebSocket.getLastInstance();
      mockWs?.simulateOpen();

      // Wait for next tick to let the stream promise resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate ready message
      mockWs?.simulateMessage({
        type: "ready",
        request_id: "req-456",
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify text was sent
      const messages = mockWs?.getSentMessages().map((m) => JSON.parse(m));
      expect(messages).toContainEqual({ type: "text", text: "Hello, world!" });
      expect(messages).toContainEqual({ type: "end_of_stream" });

      // Simulate audio and end
      const audioData = new Uint8Array([1, 2, 3, 4, 5]);
      mockWs?.simulateMessage({
        type: "audio",
        audio: btoa(String.fromCharCode(...audioData)),
      });
      mockWs?.simulateMessage({ type: "end_of_stream" });

      const result = await createPromise;

      expect(result.request_id).toBe("req-456");
      expect(result.raw_data).toEqual(audioData);
    });
  });
});
