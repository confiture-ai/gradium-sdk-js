import { AuthenticationError } from "./errors";
import { Credits } from "./resources/credits";
import { STT } from "./resources/stt";
import { TTS } from "./resources/tts";
import { Voices } from "./resources/voices";
import type { GradiumClientOptions, Region } from "./types";

const API_URLS: Record<Region, string> = {
  eu: "https://eu.api.gradium.ai/api",
  us: "https://us.api.gradium.ai/api",
};

const WS_URLS: Record<Region, string> = {
  eu: "wss://eu.api.gradium.ai/api/speech",
  us: "wss://us.api.gradium.ai/api/speech",
};

/**
 * Gradium API Client
 *
 * @example
 * ```ts
 * import Gradium from '@confiture-ai/gradium-sdk-js';
 *
 * const client = new Gradium({
 *   apiKey: process.env['GRADIUM_API_KEY'],
 * });
 *
 * // Text-to-Speech
 * const result = await client.tts.create({
 *   voice_id: 'YTpq7expH9539ERJ',
 *   output_format: 'wav',
 *   text: 'Hello, world!'
 * });
 *
 * // Speech-to-Text
 * const stream = await client.stt.stream({ input_format: 'pcm' });
 * ```
 */
export class Gradium {
  /** The API key used for authentication */
  readonly apiKey: string;

  /** The base URL for API requests */
  readonly baseURL: string;

  /** The base URL for WebSocket connections */
  readonly wsURL: string;

  /** The region for API requests */
  readonly region: Region;

  /** Request timeout in milliseconds */
  readonly timeout: number;

  /** Voices resource for managing custom voice clones */
  readonly voices: Voices;

  /** Credits resource for monitoring API credit balance */
  readonly credits: Credits;

  /** TTS resource for text-to-speech conversion */
  readonly tts: TTS;

  /** STT resource for speech-to-text conversion */
  readonly stt: STT;

  constructor(options: GradiumClientOptions = {}) {
    // Get API key from options or environment
    const apiKey = options.apiKey ?? process.env.GRADIUM_API_KEY;

    if (!apiKey) {
      throw new AuthenticationError(
        "API key is required. Pass it via options or set GRADIUM_API_KEY environment variable."
      );
    }

    this.apiKey = apiKey;
    this.region = options.region ?? "eu";
    this.timeout = options.timeout ?? 30_000;

    // Set base URLs
    if (options.baseURL) {
      this.baseURL = options.baseURL.replace(/\/$/, ""); // Remove trailing slash
      // Derive WebSocket URL from base URL
      this.wsURL = `${options.baseURL.replace(/^http/, "ws").replace(/\/$/, "")}/speech`;
    } else {
      this.baseURL = API_URLS[this.region];
      this.wsURL = WS_URLS[this.region];
    }

    // Initialize resources
    this.voices = new Voices(this);
    this.credits = new Credits(this);
    this.tts = new TTS(this);
    this.stt = new STT(this);
  }

  /**
   * Get default headers for API requests
   */
  get headers(): Record<string, string> {
    return {
      "x-api-key": this.apiKey,
      Accept: "application/json",
    };
  }
}

export default Gradium;
