import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { Gradium } from "../../client";
import {
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from "../../errors";
import { createMockResponse } from "../mocks/fetch";

describe("Voices Resource", () => {
  let client: Gradium;
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    client = new Gradium({ apiKey: "test-api-key" });
  });

  afterEach(() => {
    if (fetchSpy) {
      fetchSpy.mockRestore();
    }
  });

  describe("list", () => {
    it("should list voices", async () => {
      const mockVoices = [
        {
          uid: "voice-1",
          name: "Voice 1",
          description: "Test voice",
          language: "en",
          start_s: 0,
          filename: "voice1.wav",
        },
        {
          uid: "voice-2",
          name: "Voice 2",
          description: null,
          language: null,
          start_s: 0,
          filename: "voice2.wav",
        },
      ];

      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        createMockResponse({ status: 200, body: mockVoices })
      );

      const voices = await client.voices.list();

      expect(voices).toEqual(mockVoices);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://eu.api.gradium.ai/api/voices/");
      expect(options?.method).toBe("GET");
      expect(options?.headers).toHaveProperty("x-api-key", "test-api-key");
    });

    it("should pass query parameters", async () => {
      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        createMockResponse({ status: 200, body: [] })
      );

      await client.voices.list({
        skip: 10,
        limit: 20,
        include_catalog: true,
      });

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toContain("skip=10");
      expect(url).toContain("limit=20");
      expect(url).toContain("include_catalog=true");
    });

    it("should handle authentication errors", async () => {
      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        createMockResponse({
          status: 401,
          body: { detail: "Invalid API key" },
        })
      );

      await expect(client.voices.list()).rejects.toThrow(AuthenticationError);
    });
  });

  describe("get", () => {
    it("should get a voice by UID", async () => {
      const mockVoice = {
        uid: "voice-1",
        name: "Voice 1",
        description: "Test voice",
        language: "en",
        start_s: 0,
        filename: "voice1.wav",
      };

      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        createMockResponse({ status: 200, body: mockVoice })
      );

      const voice = await client.voices.get("voice-1");

      expect(voice).toEqual(mockVoice);
      const [url] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://eu.api.gradium.ai/api/voices/voice-1");
    });

    it("should handle not found errors", async () => {
      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        createMockResponse({
          status: 404,
          body: { detail: "Voice not found" },
        })
      );

      await expect(client.voices.get("nonexistent")).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe("create", () => {
    it("should create a voice from Blob", async () => {
      const mockResponse = {
        uid: "new-voice-uid",
        error: null,
        was_updated: false,
      };

      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        createMockResponse({ status: 200, body: mockResponse })
      );

      const audioBlob = new Blob([new Uint8Array([1, 2, 3])], {
        type: "audio/wav",
      });

      const result = await client.voices.create({
        audio_file: audioBlob,
        name: "My Voice",
        description: "Test description",
        language: "en",
      });

      expect(result).toEqual(mockResponse);

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://eu.api.gradium.ai/api/voices/");
      expect(options?.method).toBe("POST");
      expect(options?.body).toBeInstanceOf(FormData);
    });

    it("should handle validation errors", async () => {
      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        createMockResponse({
          status: 422,
          body: {
            detail: [
              { loc: ["body", "name"], msg: "required", type: "missing" },
            ],
          },
        })
      );

      const audioBlob = new Blob([new Uint8Array([1, 2, 3])]);

      await expect(
        client.voices.create({
          audio_file: audioBlob,
          name: "",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("update", () => {
    it("should update a voice", async () => {
      const mockVoice = {
        uid: "voice-1",
        name: "Updated Voice",
        description: "Updated description",
        language: "fr",
        start_s: 0,
        filename: "voice1.wav",
      };

      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        createMockResponse({ status: 200, body: mockVoice })
      );

      const voice = await client.voices.update("voice-1", {
        name: "Updated Voice",
        description: "Updated description",
        language: "fr",
      });

      expect(voice).toEqual(mockVoice);

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://eu.api.gradium.ai/api/voices/voice-1");
      expect(options?.method).toBe("PUT");
      expect(options?.headers).toHaveProperty(
        "Content-Type",
        "application/json"
      );
    });
  });

  describe("delete", () => {
    it("should delete a voice", async () => {
      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        createMockResponse({ status: 204 })
      );

      await client.voices.delete("voice-1");

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://eu.api.gradium.ai/api/voices/voice-1");
      expect(options?.method).toBe("DELETE");
    });

    it("should handle not found on delete", async () => {
      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        createMockResponse({
          status: 404,
          body: { detail: "Voice not found" },
        })
      );

      await expect(client.voices.delete("nonexistent")).rejects.toThrow(
        NotFoundError
      );
    });
  });
});
