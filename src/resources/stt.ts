import type { Gradium } from "../client";
import { ConnectionError, WebSocketError } from "../errors";
import type {
  STTAudioMessage,
  STTReadyMessage,
  STTServerMessage,
  STTSetupMessage,
  STTSetupParams,
  STTStepMessage,
  STTTextMessage,
} from "../types";

/**
 * STT Stream for handling speech-to-text streaming
 */
export class STTStream {
  private readonly ws: WebSocket;
  private requestId = "";
  private sampleRate = 24_000;
  private frameSize = 1920;
  private isReady = false;
  private readonly readyPromise: Promise<STTReadyMessage>;
  private readyResolve!: (value: STTReadyMessage) => void;
  private readyReject!: (error: Error) => void;
  private readonly endPromise: Promise<void>;
  private endResolve!: () => void;
  private endReject!: (error: Error) => void;
  private readonly messageQueue: STTServerMessage[] = [];
  private readonly textResults: STTTextMessage[] = [];
  private readonly vadResults: STTStepMessage[] = [];

  constructor(ws: WebSocket) {
    this.ws = ws;

    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    this.endPromise = new Promise((resolve, reject) => {
      this.endResolve = resolve;
      this.endReject = reject;
    });

    this.setupMessageHandler();
  }

  private setupMessageHandler(): void {
    this.ws.onmessage = (event) => {
      try {
        const message: STTServerMessage = JSON.parse(event.data as string);
        this.messageQueue.push(message);

        switch (message.type) {
          case "ready":
            this.requestId = message.request_id;
            this.sampleRate = message.sample_rate;
            this.frameSize = message.frame_size;
            this.isReady = true;
            this.readyResolve(message);
            break;
          case "text":
            this.textResults.push(message);
            break;
          case "step":
            this.vadResults.push(message);
            break;
          case "end_of_stream":
            this.endResolve();
            break;
          case "error": {
            const error = new WebSocketError(message.message, message.code);
            this.readyReject(error);
            this.endReject(error);
            break;
          }
        }
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        this.endReject(error);
      }
    };

    this.ws.onerror = () => {
      const error = new ConnectionError("WebSocket error occurred");
      this.readyReject(error);
      this.endReject(error);
    };

    this.ws.onclose = (event) => {
      if (!event.wasClean && event.code !== 1000) {
        const error = new WebSocketError(
          `WebSocket closed unexpectedly: ${event.reason}`,
          event.code
        );
        this.readyReject(error);
        this.endReject(error);
      }
    };
  }

  /**
   * Wait for the stream to be ready
   */
  async waitReady(): Promise<STTReadyMessage> {
    return this.readyPromise;
  }

  /**
   * Send audio data to be transcribed
   * @param audio - Uint8Array of audio data (PCM 24kHz 16-bit mono)
   */
  sendAudio(audio: Uint8Array): void {
    if (!this.isReady) {
      throw new WebSocketError("Stream is not ready. Call waitReady() first.");
    }
    const base64Audio = btoa(String.fromCharCode(...audio));
    const message: STTAudioMessage = { type: "audio", audio: base64Audio };
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Signal end of audio stream
   */
  sendEndOfStream(): void {
    this.ws.send(JSON.stringify({ type: "end_of_stream" }));
  }

  /**
   * Make the stream directly iterable with for-await-of
   * Iterates over text transcription results
   * @example
   * ```ts
   * for await (const result of stream) {
   *   console.log(result.text);
   * }
   * ```
   */
  [Symbol.asyncIterator](): AsyncGenerator<STTTextMessage, void, unknown> {
    return this.iterText();
  }

  /**
   * Async iterator for text transcription results
   */
  async *iterText(): AsyncGenerator<STTTextMessage, void, unknown> {
    let processedIndex = 0;

    while (true) {
      // Yield any new text results
      while (processedIndex < this.textResults.length) {
        yield this.textResults[processedIndex];
        processedIndex++;
      }

      // Check if stream has ended
      const hasEnded = this.messageQueue.some(
        (msg) => msg.type === "end_of_stream" || msg.type === "error"
      );

      if (hasEnded) {
        // Yield any remaining results
        while (processedIndex < this.textResults.length) {
          yield this.textResults[processedIndex];
          processedIndex++;
        }
        break;
      }

      // Wait a bit for more data
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  /**
   * Async iterator for VAD (Voice Activity Detection) results
   */
  async *iterVAD(): AsyncGenerator<STTStepMessage, void, unknown> {
    let processedIndex = 0;

    while (true) {
      // Yield any new VAD results
      while (processedIndex < this.vadResults.length) {
        yield this.vadResults[processedIndex];
        processedIndex++;
      }

      // Check if stream has ended
      const hasEnded = this.messageQueue.some(
        (msg) => msg.type === "end_of_stream" || msg.type === "error"
      );

      if (hasEnded) {
        // Yield any remaining results
        while (processedIndex < this.vadResults.length) {
          yield this.vadResults[processedIndex];
          processedIndex++;
        }
        break;
      }

      // Wait a bit for more data
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  /**
   * Async iterator for all messages
   */
  async *iter(): AsyncGenerator<STTServerMessage, void, unknown> {
    let processedIndex = 0;

    while (true) {
      // Yield any new messages
      while (processedIndex < this.messageQueue.length) {
        const message = this.messageQueue[processedIndex];
        // Skip ready message in the iterator
        if (message.type !== "ready") {
          yield message;
        }
        processedIndex++;
      }

      // Check if stream has ended
      const hasEnded = this.messageQueue.some(
        (msg) => msg.type === "end_of_stream" || msg.type === "error"
      );

      if (hasEnded) {
        break;
      }

      // Wait a bit for more data
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  /**
   * Wait for the stream to complete and return all text results
   */
  async collectText(): Promise<string> {
    await this.endPromise;
    return this.textResults.map((t) => t.text).join(" ");
  }

  /**
   * Close the stream
   */
  close(): void {
    this.ws.close();
  }

  /**
   * Get the request ID
   */
  getRequestId(): string {
    return this.requestId;
  }

  /**
   * Get the sample rate
   */
  getSampleRate(): number {
    return this.sampleRate;
  }

  /**
   * Get the frame size
   */
  getFrameSize(): number {
    return this.frameSize;
  }
}

/**
 * STT resource for speech-to-text conversion
 */
export class STT {
  private readonly client: Gradium;

  constructor(client: Gradium) {
    this.client = client;
  }

  /**
   * Create a streaming STT connection
   *
   * @example
   * ```ts
   * const stream = await client.stt.stream({
   *   input_format: 'pcm',
   *   model_name: 'default'
   * });
   *
   * const readyInfo = await stream.waitReady();
   * console.log(`Sample rate: ${readyInfo.sample_rate}`);
   *
   * // Send audio chunks
   * stream.sendAudio(audioChunk1);
   * stream.sendAudio(audioChunk2);
   * stream.sendEndOfStream();
   *
   * // Process transcription results
   * for await (const result of stream) {
   *   console.log(`Transcription: ${result.text} at ${result.start_s}s`);
   * }
   * ```
   */
  async stream(params: STTSetupParams): Promise<STTStream> {
    const wsUrl = `${this.client.wsURL}/stt`;

    return new Promise((resolve, reject) => {
      // Bun's WebSocket supports headers option for authentication
      const ws = new WebSocket(wsUrl, {
        headers: {
          "x-api-key": this.client.apiKey,
        },
      } as any);

      const stream = new STTStream(ws);

      ws.onopen = () => {
        // Send setup message
        const setupMessage: STTSetupMessage = {
          type: "setup",
          input_format: params.input_format,
          model_name: params.model_name || "default",
        };

        ws.send(JSON.stringify(setupMessage));
        resolve(stream);
      };

      ws.onerror = () => {
        reject(new ConnectionError("Failed to connect to STT WebSocket"));
      };
    });
  }

  /**
   * Stream STT with an async audio generator
   *
   * @example
   * ```ts
   * async function* audioGenerator() {
   *   // Yield audio chunks (PCM 24kHz 16-bit mono)
   *   for (const chunk of audioChunks) {
   *     yield chunk;
   *   }
   * }
   *
   * const stream = await client.stt.streamAudio({
   *   input_format: 'pcm'
   * }, audioGenerator());
   *
   * for await (const result of stream) {
   *   console.log(`Transcription: ${result.text}`);
   * }
   * ```
   */
  async streamAudio(
    params: STTSetupParams,
    audioGenerator: AsyncIterable<Uint8Array>
  ): Promise<STTStream> {
    const stream = await this.stream(params);
    await stream.waitReady();

    // Send audio chunks asynchronously
    (async () => {
      for await (const audio of audioGenerator) {
        stream.sendAudio(audio);
      }
      stream.sendEndOfStream();
    })();

    return stream;
  }

  /**
   * Transcribe complete audio data (non-streaming)
   *
   * @example
   * ```ts
   * const audioData = await Bun.file('audio.wav').arrayBuffer();
   * const text = await client.stt.transcribe({
   *   input_format: 'wav'
   * }, new Uint8Array(audioData));
   *
   * console.log(`Transcription: ${text}`);
   * ```
   */
  async transcribe(params: STTSetupParams, audio: Uint8Array): Promise<string> {
    const stream = await this.stream(params);
    await stream.waitReady();

    // Send audio in chunks (recommended: 1920 samples = 80ms at 24kHz)
    const chunkSize = 1920 * 2; // 16-bit = 2 bytes per sample
    for (let i = 0; i < audio.length; i += chunkSize) {
      const chunk = audio.slice(i, Math.min(i + chunkSize, audio.length));
      stream.sendAudio(chunk);
    }

    stream.sendEndOfStream();
    return stream.collectText();
  }
}
