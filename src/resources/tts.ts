import type { Gradium } from "../client";
import { ConnectionError, WebSocketError } from "../errors";
import type {
  TTSResult,
  TTSServerMessage,
  TTSSetupMessage,
  TTSSetupParams,
  TTSTextMessage,
} from "../types";

/**
 * TTS Stream for handling streamed audio responses
 */
export class TTSStream {
  private readonly ws: WebSocket;
  private readonly audioChunks: Uint8Array[] = [];
  private requestId = "";
  private readonly sampleRate = 48_000;
  private isReady = false;
  private readonly readyPromise: Promise<void>;
  private readyResolve!: () => void;
  private readyReject!: (error: Error) => void;
  private readonly endPromise: Promise<void>;
  private endResolve!: () => void;
  private endReject!: (error: Error) => void;
  private readonly messageQueue: TTSServerMessage[] = [];

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
        const message: TTSServerMessage = JSON.parse(event.data as string);
        this.messageQueue.push(message);

        switch (message.type) {
          case "ready":
            this.requestId = message.request_id;
            this.isReady = true;
            this.readyResolve();
            break;
          case "audio": {
            const audioData = Uint8Array.from(atob(message.audio), (c) =>
              c.charCodeAt(0)
            );
            this.audioChunks.push(audioData);
            break;
          }
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
  async waitReady(): Promise<void> {
    return this.readyPromise;
  }

  /**
   * Send text to be converted to speech
   */
  sendText(text: string): void {
    if (!this.isReady) {
      throw new WebSocketError("Stream is not ready. Call waitReady() first.");
    }
    const message: TTSTextMessage = { type: "text", text };
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Signal end of input stream
   */
  sendEndOfStream(): void {
    this.ws.send(JSON.stringify({ type: "end_of_stream" }));
  }

  /**
   * Async iterator for audio chunks
   * @example
   * ```ts
   * for await (const chunk of stream) {
   *   // Process audio chunk
   * }
   * ```
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array, void, unknown> {
    let processedIndex = 0;

    while (true) {
      // Yield any new chunks
      while (processedIndex < this.audioChunks.length) {
        yield this.audioChunks[processedIndex];
        processedIndex++;
      }

      // Check if stream has ended
      const hasEnded = this.messageQueue.some(
        (msg) => msg.type === "end_of_stream" || msg.type === "error"
      );

      if (hasEnded) {
        // Yield any remaining chunks
        while (processedIndex < this.audioChunks.length) {
          yield this.audioChunks[processedIndex];
          processedIndex++;
        }
        break;
      }

      // Wait a bit for more data
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  /**
   * Wait for the stream to complete and return all audio
   */
  async collect(): Promise<TTSResult> {
    await this.endPromise;

    // Concatenate all audio chunks
    const totalLength = this.audioChunks.reduce(
      (sum, chunk) => sum + chunk.length,
      0
    );
    const rawData = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.audioChunks) {
      rawData.set(chunk, offset);
      offset += chunk.length;
    }

    return {
      raw_data: rawData,
      sample_rate: this.sampleRate,
      request_id: this.requestId,
    };
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
}

/**
 * TTS resource for text-to-speech conversion
 */
export class TTS {
  private readonly client: Gradium;

  constructor(client: Gradium) {
    this.client = client;
  }

  /**
   * Convert text to speech (non-streaming, returns complete audio)
   *
   * @example
   * ```ts
   * const result = await client.tts.create({
   *   voice_id: 'YTpq7expH9539ERJ',
   *   output_format: 'wav',
   *   text: 'Hello, world!'
   * });
   *
   * await Bun.write('output.wav', result.raw_data);
   * ```
   */
  async create(params: TTSSetupParams & { text: string }): Promise<TTSResult> {
    const stream = await this.stream(params);
    await stream.waitReady();
    stream.sendText(params.text);
    stream.sendEndOfStream();
    return stream.collect();
  }

  /**
   * Create a streaming TTS connection
   *
   * @example
   * ```ts
   * const stream = await client.tts.stream({
   *   voice_id: 'YTpq7expH9539ERJ',
   *   output_format: 'pcm'
   * });
   *
   * await stream.waitReady();
   *
   * stream.sendText('Hello, world!');
   * stream.sendEndOfStream();
   *
   * for await (const chunk of stream) {
   *   console.log(`Received ${chunk.length} bytes`);
   * }
   * ```
   */
  async stream(params: TTSSetupParams): Promise<TTSStream> {
    const wsUrl = `${this.client.wsURL}/tts`;

    return new Promise((resolve, reject) => {
      // Bun's WebSocket supports headers option for authentication
      const ws = new WebSocket(wsUrl, {
        headers: {
          "x-api-key": this.client.apiKey,
        },
      } as any);

      const stream = new TTSStream(ws);

      ws.onopen = () => {
        // Send setup message
        const setupMessage: TTSSetupMessage = {
          type: "setup",
          voice_id: params.voice_id,
          output_format: params.output_format,
          model_name: params.model_name || "default",
        };

        if (params.json_config) {
          setupMessage.json_config = params.json_config;
        }

        ws.send(JSON.stringify(setupMessage));
        resolve(stream);
      };

      ws.onerror = () => {
        reject(new ConnectionError("Failed to connect to TTS WebSocket"));
      };
    });
  }

  /**
   * Stream TTS with an async text generator
   *
   * @example
   * ```ts
   * async function* textGenerator() {
   *   yield 'Hello, ';
   *   yield 'this is ';
   *   yield 'a streaming ';
   *   yield 'example.';
   * }
   *
   * const stream = await client.tts.streamText({
   *   voice_id: 'YTpq7expH9539ERJ',
   *   output_format: 'pcm'
   * }, textGenerator());
   *
   * for await (const chunk of stream) {
   *   console.log(`Received ${chunk.length} bytes`);
   * }
   * ```
   */
  async streamText(
    params: TTSSetupParams,
    textGenerator: AsyncIterable<string>
  ): Promise<TTSStream> {
    const stream = await this.stream(params);
    await stream.waitReady();

    // Send text chunks asynchronously
    (async () => {
      for await (const text of textGenerator) {
        stream.sendText(text);
      }
      stream.sendEndOfStream();
    })();

    return stream;
  }
}
