// ============================================================================
// Client Configuration
// ============================================================================

export type Region = "eu" | "us";

export type GradiumClientOptions = {
  /**
   * API key for authentication.
   * Defaults to process.env['GRADIUM_API_KEY']
   */
  apiKey?: string;

  /**
   * API region: 'eu' or 'us'
   * @default 'eu'
   */
  region?: Region;

  /**
   * Base URL override for the API.
   * If provided, region is ignored.
   */
  baseURL?: string;

  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  timeout?: number;
};

// ============================================================================
// Voice Types
// ============================================================================

export type Voice = {
  /** Unique identifier for the voice */
  uid: string;
  /** Display name of the voice */
  name: string;
  /** Optional description of the voice */
  description?: string | null;
  /** Language code (e.g., 'en', 'fr', 'de') */
  language?: string | null;
  /** Start time in seconds for the audio sample */
  start_s: number;
  /** Stop time in seconds for the audio sample */
  stop_s?: number | null;
  /** Original filename of the voice sample */
  filename: string;
};

export type VoiceCreateParams = {
  /** Audio file for voice cloning (File, Blob, or path string) */
  audio_file: File | Blob | string;
  /** Name for the voice */
  name: string;
  /** Input format of the audio file */
  input_format?: string;
  /** Optional description */
  description?: string | null;
  /** Language code */
  language?: string | null;
  /** Start time in seconds (default: 0) */
  start_s?: number;
  /** Timeout in seconds (default: 10) */
  timeout_s?: number;
};

export type VoiceCreateResponse = {
  /** UID of the created voice */
  uid?: string | null;
  /** Error message if creation failed */
  error?: string | null;
  /** Whether an existing voice was updated */
  was_updated?: boolean;
};

export type VoiceUpdateParams = {
  /** New name for the voice */
  name?: string | null;
  /** New description */
  description?: string | null;
  /** New language code */
  language?: string | null;
  /** New start time in seconds */
  start_s?: number | null;
  /** Tags for the voice */
  tags?: Record<string, string | boolean | null>[] | null;
  /** Rank/priority of the voice */
  rank?: number | null;
};

export type VoiceListParams = {
  /** Number of items to skip (default: 0) */
  skip?: number;
  /** Maximum number of items to return (default: 100) */
  limit?: number;
  /** Include catalog voices (default: false) */
  include_catalog?: boolean;
};

// ============================================================================
// Credits Types
// ============================================================================

export type CreditsSummary = {
  /** Remaining credits in the current billing period */
  remaining_credits: number;
  /** Total allocated credits for the billing period */
  allocated_credits: number;
  /** Current billing period identifier */
  billing_period: string;
  /** Date when credits will roll over (ISO date string) */
  next_rollover_date?: string | null;
  /** Name of the current plan */
  plan_name?: string;
};

// ============================================================================
// TTS (Text-to-Speech) Types
// ============================================================================

/**
 * Output audio format for TTS
 * - `wav` - WAV format with headers (24kHz, 16-bit mono)
 * - `pcm` - Raw PCM audio (24kHz, 16-bit mono, no headers)
 * - `opus` - Opus compressed audio (low bandwidth, high quality)
 * - `ulaw_8000` - µ-law encoding at 8kHz (telephony standard, NA/Japan)
 * - `alaw_8000` - A-law encoding at 8kHz (telephony standard, Europe)
 * - `pcm_16000` - Raw PCM at 16kHz (16-bit mono)
 * - `pcm_24000` - Raw PCM at 24kHz (16-bit mono)
 */
export type TTSOutputFormat =
  | "wav"
  | "pcm"
  | "opus"
  | "ulaw_8000"
  | "alaw_8000"
  | "pcm_16000"
  | "pcm_24000";

export type TTSSetupParams = {
  /** Voice ID to use for synthesis */
  voice_id: string;
  /** Output audio format */
  output_format: TTSOutputFormat;
  /** Model name (default: 'default') */
  model_name?: string;
  /** JSON configuration for advanced settings */
  json_config?: {
    /** Speed control: negative = faster (-4.0 to -0.1), positive = slower (0.1 to 4.0) */
    padding_bonus?: number;
  };
};

export type TTSTextParams = {
  /** Text to convert to speech */
  text: string;
};

// TTS WebSocket Message Types
export type TTSSetupMessage = {
  type: "setup";
  voice_id: string;
  output_format: TTSOutputFormat;
  model_name: string;
  json_config?: Record<string, unknown>;
};

export type TTSTextMessage = {
  type: "text";
  text: string;
};

export type TTSEndOfStreamMessage = {
  type: "end_of_stream";
};

export type TTSClientMessage =
  | TTSSetupMessage
  | TTSTextMessage
  | TTSEndOfStreamMessage;

export type TTSReadyMessage = {
  type: "ready";
  request_id: string;
};

export type TTSAudioMessage = {
  type: "audio";
  audio: string; // Base64-encoded audio data
};

export type TTSErrorMessage = {
  type: "error";
  message: string;
  code: number;
};

export type TTSServerEndOfStreamMessage = {
  type: "end_of_stream";
};

export type TTSServerMessage =
  | TTSReadyMessage
  | TTSAudioMessage
  | TTSErrorMessage
  | TTSServerEndOfStreamMessage;

export type TTSResult = {
  /** Raw audio data as Uint8Array */
  raw_data: Uint8Array;
  /** Sample rate of the audio */
  sample_rate: number;
  /** Request ID from the server */
  request_id: string;
};

// ============================================================================
// STT (Speech-to-Text) Types
// ============================================================================

export type STTInputFormat = "pcm" | "wav" | "opus";

export type STTSetupParams = {
  /** Input audio format */
  input_format: STTInputFormat;
  /** Model name (default: 'default') */
  model_name?: string;
};

// STT WebSocket Message Types
export type STTSetupMessage = {
  type: "setup";
  model_name: string;
  input_format: STTInputFormat;
};

export type STTAudioMessage = {
  type: "audio";
  audio: string; // Base64-encoded audio data
};

export type STTEndOfStreamMessage = {
  type: "end_of_stream";
};

export type STTClientMessage =
  | STTSetupMessage
  | STTAudioMessage
  | STTEndOfStreamMessage;

export type STTReadyMessage = {
  type: "ready";
  request_id: string;
  model_name: string;
  sample_rate: number;
  frame_size: number;
  delay_in_tokens: number;
  text_stream_names: string[];
};

export type STTTextMessage = {
  type: "text";
  text: string;
  start_s: number;
  stream_id?: number | null;
};

export type VADPrediction = {
  horizon_s: number;
  inactivity_prob: number;
};

export type STTStepMessage = {
  type: "step";
  vad: VADPrediction[];
  step_idx: number;
  step_duration_s: number;
  total_duration_s: number;
};

export type STTEndTextMessage = {
  type: "end_text";
  stop_s: number;
  stream_id?: number | null;
};

export type STTErrorMessage = {
  type: "error";
  message: string;
  code: number;
};

export type STTServerEndOfStreamMessage = {
  type: "end_of_stream";
};

export type STTServerMessage =
  | STTReadyMessage
  | STTTextMessage
  | STTStepMessage
  | STTEndTextMessage
  | STTErrorMessage
  | STTServerEndOfStreamMessage;

// ============================================================================
// Error Types
// ============================================================================

export type ValidationErrorDetail = {
  loc: (string | number)[];
  msg: string;
  type: string;
};

export type HTTPValidationError = {
  detail: ValidationErrorDetail[];
};
