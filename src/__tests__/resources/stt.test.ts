import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Gradium } from "../../client";
import { WebSocketError } from "../../errors";
import { STTStream } from "../../resources/stt";
import {
  createMockWebSocketConstructor,
  MockWebSocket,
} from "../mocks/websocket";

describe("STT Resource", () => {
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

  describe("STTStream", () => {
    it("should handle ready message", async () => {
      const mockWs = new MockWebSocket("wss://test");
      const stream = new STTStream(mockWs as any);

      mockWs.simulateMessage({
        type: "ready",
        request_id: "req-123",
        model_name: "default",
        sample_rate: 24_000,
        frame_size: 1920,
        delay_in_tokens: 3,
        text_stream_names: ["primary"],
      });

      const readyInfo = await stream.waitReady();

      expect(readyInfo.request_id).toBe("req-123");
      expect(readyInfo.sample_rate).toBe(24_000);
      expect(readyInfo.frame_size).toBe(1920);
      expect(stream.getRequestId()).toBe("req-123");
      expect(stream.getSampleRate()).toBe(24_000);
      expect(stream.getFrameSize()).toBe(1920);
    });

    it("should throw error when sending audio before ready", () => {
      const mockWs = new MockWebSocket("wss://test");
      const stream = new STTStream(mockWs as any);

      const audioData = new Uint8Array([1, 2, 3]);
      expect(() => stream.sendAudio(audioData)).toThrow(WebSocketError);
      expect(() => stream.sendAudio(audioData)).toThrow(
        "Stream is not ready. Call waitReady() first."
      );
    });

    it("should send audio correctly", async () => {
      const mockWs = new MockWebSocket("wss://test");
      const stream = new STTStream(mockWs as any);

      mockWs.simulateMessage({
        type: "ready",
        request_id: "req-123",
        model_name: "default",
        sample_rate: 24_000,
        frame_size: 1920,
        delay_in_tokens: 3,
        text_stream_names: ["primary"],
      });

      await stream.waitReady();

      const audioData = new Uint8Array([1, 2, 3, 4, 5]);
      stream.sendAudio(audioData);

      const sentMessage = mockWs.getLastSentJSON<{
        type: string;
        audio: string;
      }>();
      expect(sentMessage?.type).toBe("audio");
      // Verify base64 encoded audio
      const decodedAudio = Uint8Array.from(
        atob(sentMessage?.audio ?? ""),
        (c) => c.charCodeAt(0)
      );
      expect(decodedAudio).toEqual(audioData);
    });

    it("should send end of stream", async () => {
      const mockWs = new MockWebSocket("wss://test");
      const stream = new STTStream(mockWs as any);

      mockWs.simulateMessage({
        type: "ready",
        request_id: "req-123",
        model_name: "default",
        sample_rate: 24_000,
        frame_size: 1920,
        delay_in_tokens: 3,
        text_stream_names: ["primary"],
      });

      await stream.waitReady();
      stream.sendEndOfStream();

      const sentMessage = mockWs.getLastSentJSON<{ type: string }>();
      expect(sentMessage).toEqual({ type: "end_of_stream" });
    });

    it("should be directly iterable with for-await-of", async () => {
      const mockWs = new MockWebSocket("wss://test");
      const stream = new STTStream(mockWs as any);

      mockWs.simulateMessage({
        type: "ready",
        request_id: "req-123",
        model_name: "default",
        sample_rate: 24_000,
        frame_size: 1920,
        delay_in_tokens: 3,
        text_stream_names: ["primary"],
      });

      await stream.waitReady();

      // Simulate text results
      setTimeout(() => {
        mockWs.simulateMessage({
          type: "text",
          text: "Hello",
          start_s: 0.0,
        });
      }, 10);

      setTimeout(() => {
        mockWs.simulateMessage({
          type: "text",
          text: "world",
          start_s: 0.5,
        });
      }, 20);

      setTimeout(() => {
        mockWs.simulateMessage({ type: "end_of_stream" });
      }, 30);

      const results: Array<{ text: string; start_s: number }> = [];
      // Direct iteration using Symbol.asyncIterator
      for await (const result of stream) {
        results.push({ text: result.text, start_s: result.start_s });
      }

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ text: "Hello", start_s: 0.0 });
      expect(results[1]).toEqual({ text: "world", start_s: 0.5 });
    });

    it("should iterate over VAD results", async () => {
      const mockWs = new MockWebSocket("wss://test");
      const stream = new STTStream(mockWs as any);

      mockWs.simulateMessage({
        type: "ready",
        request_id: "req-123",
        model_name: "default",
        sample_rate: 24_000,
        frame_size: 1920,
        delay_in_tokens: 3,
        text_stream_names: ["primary"],
      });

      await stream.waitReady();

      // Simulate VAD results
      setTimeout(() => {
        mockWs.simulateMessage({
          type: "step",
          vad: [{ horizon_s: 0.5, inactivity_prob: 0.1 }],
          step_idx: 0,
          step_duration_s: 0.08,
          total_duration_s: 0.08,
        });
      }, 10);

      setTimeout(() => {
        mockWs.simulateMessage({ type: "end_of_stream" });
      }, 20);

      const vadResults: Array<{ step_idx: number }> = [];
      for await (const result of stream.iterVAD()) {
        vadResults.push({ step_idx: result.step_idx });
      }

      expect(vadResults).toHaveLength(1);
      expect(vadResults[0].step_idx).toBe(0);
    });

    it("should collect all text", async () => {
      const mockWs = new MockWebSocket("wss://test");
      const stream = new STTStream(mockWs as any);

      mockWs.simulateMessage({
        type: "ready",
        request_id: "req-123",
        model_name: "default",
        sample_rate: 24_000,
        frame_size: 1920,
        delay_in_tokens: 3,
        text_stream_names: ["primary"],
      });

      await stream.waitReady();

      mockWs.simulateMessage({
        type: "text",
        text: "Hello",
        start_s: 0.0,
      });

      mockWs.simulateMessage({
        type: "text",
        text: "world",
        start_s: 0.5,
      });

      mockWs.simulateMessage({ type: "end_of_stream" });

      const text = await stream.collectText();
      expect(text).toBe("Hello world");
    });

    it("should handle error messages", async () => {
      const mockWs = new MockWebSocket("wss://test");
      const stream = new STTStream(mockWs as any);

      mockWs.simulateMessage({
        type: "error",
        message: "Invalid audio format",
        code: 400,
      });

      // Both promises should reject with the same error
      const [readyResult, collectResult] = await Promise.allSettled([
        stream.waitReady(),
        stream.collectText(),
      ]);

      expect(readyResult.status).toBe("rejected");
      expect(collectResult.status).toBe("rejected");

      if (readyResult.status === "rejected") {
        expect(readyResult.reason).toBeInstanceOf(WebSocketError);
        expect(readyResult.reason.message).toBe("Invalid audio format");
      }
    });

    it("should close the WebSocket", () => {
      const mockWs = new MockWebSocket("wss://test");
      const stream = new STTStream(mockWs as any);

      stream.close();
      expect(mockWs.readyState).toBe(MockWebSocket.CLOSED);
    });
  });

  describe("STT.stream", () => {
    it("should create an STT stream and send setup message", async () => {
      const streamPromise = client.stt.stream({
        input_format: "pcm",
        model_name: "default",
      });

      const mockWs = MockWebSocket.getLastInstance();
      expect(mockWs).toBeDefined();

      mockWs?.simulateOpen();

      const stream = await streamPromise;
      expect(stream).toBeInstanceOf(STTStream);

      // Verify setup message was sent
      const setupMessage = mockWs?.getLastSentJSON<{
        type: string;
        input_format: string;
        model_name: string;
      }>();

      expect(setupMessage).toEqual({
        type: "setup",
        input_format: "pcm",
        model_name: "default",
      });
    });
  });

  describe("STT.transcribe", () => {
    it("should transcribe audio and return text", async () => {
      const audioData = new Uint8Array(4000); // Simulated audio data

      const transcribePromise = client.stt.transcribe(
        { input_format: "pcm" },
        audioData
      );

      const mockWs = MockWebSocket.getLastInstance();
      mockWs?.simulateOpen();

      await new Promise((resolve) => setTimeout(resolve, 0));

      mockWs?.simulateMessage({
        type: "ready",
        request_id: "req-789",
        model_name: "default",
        sample_rate: 24_000,
        frame_size: 1920,
        delay_in_tokens: 3,
        text_stream_names: ["primary"],
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate transcription results
      mockWs?.simulateMessage({
        type: "text",
        text: "This is a test",
        start_s: 0.0,
      });

      mockWs?.simulateMessage({ type: "end_of_stream" });

      const text = await transcribePromise;
      expect(text).toBe("This is a test");
    });
  });
});
