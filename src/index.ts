/**
 * Gradium AI SDK
 *
 * Official TypeScript SDK for the Gradium API
 * Text-to-Speech and Speech-to-Text services
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
 * await Bun.write('output.wav', result.raw_data);
 *
 * // Speech-to-Text streaming
 * const stream = await client.stt.stream({ input_format: 'pcm' });
 * await stream.waitReady();
 * stream.sendAudio(audioData);
 * stream.sendEndOfStream();
 *
 * for await (const result of stream) {
 *   console.log(result.text);
 * }
 * ```
 *
 * @packageDocumentation
 */

// Main client
export { default, Gradium } from "./client";
// Errors
export {
  APIError,
  AuthenticationError,
  ConnectionError,
  GradiumError,
  InternalServerError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  ValidationError,
  WebSocketError,
} from "./errors";
export { Credits } from "./resources/credits";
export { STT, STTStream } from "./resources/stt";
export { TTS, TTSStream } from "./resources/tts";
// Resources
export { Voices } from "./resources/voices";

// Types
export type {
  // Credits
  CreditsSummary,
  // Client
  GradiumClientOptions,
  HTTPValidationError,
  Region,
  STTEndTextMessage,
  STTInputFormat,
  STTReadyMessage,
  STTServerMessage,
  // STT
  STTSetupParams,
  STTStepMessage,
  STTTextMessage,
  TTSAudioMessage,
  TTSErrorMessage,
  TTSOutputFormat,
  TTSReadyMessage,
  TTSResult,
  TTSServerMessage,
  // TTS
  TTSSetupParams,
  VADPrediction,
  // Errors
  ValidationErrorDetail,
  // Voice
  Voice,
  VoiceCreateParams,
  VoiceCreateResponse,
  VoiceListParams,
  VoiceUpdateParams,
} from "./types";
