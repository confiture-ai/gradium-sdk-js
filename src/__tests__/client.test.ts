import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Gradium } from "../client";
import { AuthenticationError } from "../errors";

describe("Gradium Client", () => {
  const originalEnv = process.env.GRADIUM_API_KEY;

  beforeEach(() => {
    // Clear env var before each test
    // biome-ignore lint/performance/noDelete: used for testing only
    delete process.env.GRADIUM_API_KEY;
  });

  afterEach(() => {
    // Restore original env var
    if (originalEnv) {
      process.env.GRADIUM_API_KEY = originalEnv;
    }
  });

  describe("constructor", () => {
    it("should create client with API key from options", () => {
      const client = new Gradium({ apiKey: "test-api-key" });
      expect(client.apiKey).toBe("test-api-key");
    });

    it("should create client with API key from environment", () => {
      process.env.GRADIUM_API_KEY = "env-api-key";
      const client = new Gradium();
      expect(client.apiKey).toBe("env-api-key");
    });

    it("should throw AuthenticationError when no API key provided", () => {
      expect(() => new Gradium()).toThrow(AuthenticationError);
      expect(() => new Gradium()).toThrow(
        "API key is required. Pass it via options or set GRADIUM_API_KEY environment variable."
      );
    });

    it("should prefer options API key over environment", () => {
      process.env.GRADIUM_API_KEY = "env-api-key";
      const client = new Gradium({ apiKey: "options-api-key" });
      expect(client.apiKey).toBe("options-api-key");
    });
  });

  describe("region configuration", () => {
    it("should default to EU region", () => {
      const client = new Gradium({ apiKey: "test-key" });
      expect(client.region).toBe("eu");
      expect(client.baseURL).toBe("https://eu.api.gradium.ai/api");
      expect(client.wsURL).toBe("wss://eu.api.gradium.ai/api/speech");
    });

    it("should use US region when specified", () => {
      const client = new Gradium({ apiKey: "test-key", region: "us" });
      expect(client.region).toBe("us");
      expect(client.baseURL).toBe("https://us.api.gradium.ai/api");
      expect(client.wsURL).toBe("wss://us.api.gradium.ai/api/speech");
    });

    it("should use custom baseURL when provided", () => {
      const client = new Gradium({
        apiKey: "test-key",
        baseURL: "https://custom.api.example.com/",
      });
      expect(client.baseURL).toBe("https://custom.api.example.com");
      expect(client.wsURL).toBe("wss://custom.api.example.com/speech");
    });

    it("should strip trailing slash from baseURL", () => {
      const client = new Gradium({
        apiKey: "test-key",
        baseURL: "https://custom.api.example.com/api/",
      });
      expect(client.baseURL).toBe("https://custom.api.example.com/api");
    });
  });

  describe("timeout configuration", () => {
    it("should default to 30 seconds", () => {
      const client = new Gradium({ apiKey: "test-key" });
      expect(client.timeout).toBe(30_000);
    });

    it("should use custom timeout when provided", () => {
      const client = new Gradium({ apiKey: "test-key", timeout: 60_000 });
      expect(client.timeout).toBe(60_000);
    });
  });

  describe("headers", () => {
    it("should return correct headers", () => {
      const client = new Gradium({ apiKey: "test-api-key" });
      const headers = client.headers;
      expect(headers).toEqual({
        "x-api-key": "test-api-key",
        Accept: "application/json",
      });
    });
  });

  describe("resource initialization", () => {
    it("should initialize all resources", () => {
      const client = new Gradium({ apiKey: "test-key" });
      expect(client.voices).toBeDefined();
      expect(client.credits).toBeDefined();
      expect(client.tts).toBeDefined();
      expect(client.stt).toBeDefined();
    });
  });
});
