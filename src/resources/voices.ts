import type { Gradium } from "../client";
import { handleAPIError } from "../errors";
import type {
  Voice,
  VoiceCreateParams,
  VoiceCreateResponse,
  VoiceListParams,
  VoiceUpdateParams,
} from "../types";

/**
 * Voices resource for managing custom voice clones
 */
export class Voices {
  private readonly client: Gradium;

  constructor(client: Gradium) {
    this.client = client;
  }

  /**
   * List all voices for the authenticated organization
   *
   * @example
   * ```ts
   * const voices = await client.voices.list();
   * console.log(voices);
   *
   * // With pagination and catalog voices
   * const allVoices = await client.voices.list({
   *   skip: 0,
   *   limit: 50,
   *   include_catalog: true
   * });
   * ```
   */
  async list(params?: VoiceListParams): Promise<Voice[]> {
    const searchParams = new URLSearchParams();

    if (params?.skip !== undefined) {
      searchParams.set("skip", String(params.skip));
    }
    if (params?.limit !== undefined) {
      searchParams.set("limit", String(params.limit));
    }
    if (params?.include_catalog !== undefined) {
      searchParams.set("include_catalog", String(params.include_catalog));
    }

    const queryString = searchParams.toString();
    const url = `${this.client.baseURL}/voices/${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.client.headers,
    });

    if (!response.ok) {
      await handleAPIError(response);
    }

    return response.json();
  }

  /**
   * Get a specific voice by its UID
   *
   * @example
   * ```ts
   * const voice = await client.voices.get('voice_uid_here');
   * console.log(voice.name);
   * ```
   */
  async get(voiceUid: string): Promise<Voice> {
    const response = await fetch(`${this.client.baseURL}/voices/${voiceUid}`, {
      method: "GET",
      headers: this.client.headers,
    });

    if (!response.ok) {
      await handleAPIError(response);
    }

    return response.json();
  }

  /**
   * Create a new custom voice from an audio file
   *
   * @example
   * ```ts
   * // Using a file path
   * const voice = await client.voices.create({
   *   audio_file: './my_voice_sample.wav',
   *   name: 'My Custom Voice',
   *   description: 'A voice created from my recording',
   *   language: 'en'
   * });
   *
   * // Using a Blob
   * const blob = new Blob([audioData], { type: 'audio/wav' });
   * const voice = await client.voices.create({
   *   audio_file: blob,
   *   name: 'My Custom Voice'
   * });
   * ```
   */
  async create(params: VoiceCreateParams): Promise<VoiceCreateResponse> {
    const formData = new FormData();

    // Handle audio file
    if (typeof params.audio_file === "string") {
      // File path - read the file
      const file = Bun.file(params.audio_file);
      const blob = await file.arrayBuffer();
      const filename = params.audio_file.split("/").pop() || "audio.wav";
      formData.append("audio_file", new Blob([blob]), filename);
    } else {
      // Blob or File
      formData.append("audio_file", params.audio_file);
    }

    // Add other fields
    formData.append("name", params.name);

    if (params.input_format) {
      formData.append("input_format", params.input_format);
    }
    if (params.description !== undefined && params.description !== null) {
      formData.append("description", params.description);
    }
    if (params.language !== undefined && params.language !== null) {
      formData.append("language", params.language);
    }
    if (params.start_s !== undefined) {
      formData.append("start_s", String(params.start_s));
    }
    if (params.timeout_s !== undefined) {
      formData.append("timeout_s", String(params.timeout_s));
    }

    // Don't include Content-Type header - let fetch set it with boundary
    const headers: Record<string, string> = {
      "x-api-key": this.client.apiKey,
    };

    const response = await fetch(`${this.client.baseURL}/voices/`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      await handleAPIError(response);
    }

    return response.json();
  }

  /**
   * Update an existing voice
   *
   * @example
   * ```ts
   * const voice = await client.voices.update('voice_uid_here', {
   *   name: 'Updated Voice Name',
   *   description: 'New description'
   * });
   * ```
   */
  async update(voiceUid: string, params: VoiceUpdateParams): Promise<Voice> {
    const response = await fetch(`${this.client.baseURL}/voices/${voiceUid}`, {
      method: "PUT",
      headers: {
        ...this.client.headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      await handleAPIError(response);
    }

    return response.json();
  }

  /**
   * Delete a voice
   *
   * @example
   * ```ts
   * await client.voices.delete('voice_uid_here');
   * ```
   */
  async delete(voiceUid: string): Promise<void> {
    const response = await fetch(`${this.client.baseURL}/voices/${voiceUid}`, {
      method: "DELETE",
      headers: this.client.headers,
    });

    if (!response.ok) {
      await handleAPIError(response);
    }
  }
}
