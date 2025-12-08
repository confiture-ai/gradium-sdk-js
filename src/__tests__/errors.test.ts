import { describe, expect, it } from "bun:test";
import {
  APIError,
  AuthenticationError,
  ConnectionError,
  GradiumError,
  handleAPIError,
  InternalServerError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  ValidationError,
  WebSocketError,
} from "../errors";
import { createMockResponse } from "./mocks/fetch";

describe("Errors", () => {
  describe("GradiumError", () => {
    it("should create base error with message", () => {
      const error = new GradiumError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.name).toBe("GradiumError");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("AuthenticationError", () => {
    it("should create with default message", () => {
      const error = new AuthenticationError();
      expect(error.message).toBe("Invalid or missing API key");
      expect(error.name).toBe("AuthenticationError");
    });

    it("should create with custom message", () => {
      const error = new AuthenticationError("Custom auth error");
      expect(error.message).toBe("Custom auth error");
    });

    it("should be instanceof GradiumError", () => {
      const error = new AuthenticationError();
      expect(error).toBeInstanceOf(GradiumError);
    });
  });

  describe("ValidationError", () => {
    it("should format validation errors", () => {
      const details = [
        { loc: ["body", "voice_id"], msg: "field required", type: "missing" },
        {
          loc: ["body", "text"],
          msg: "must not be empty",
          type: "value_error",
        },
      ];
      const error = new ValidationError(details);
      expect(error.message).toBe(
        "body.voice_id: field required; body.text: must not be empty"
      );
      expect(error.status).toBe(422);
      expect(error.errors).toEqual(details);
    });

    it("should use custom message when provided", () => {
      const details = [
        { loc: ["body", "field"], msg: "error", type: "value_error" },
      ];
      const error = new ValidationError(details, "Custom validation message");
      expect(error.message).toBe("Custom validation message");
    });
  });

  describe("APIError", () => {
    it("should store status and body", () => {
      const body = { detail: "Some error" };
      const error = new APIError(400, "Bad request", body);
      expect(error.status).toBe(400);
      expect(error.body).toEqual(body);
      expect(error.message).toBe("Bad request");
      expect(error.name).toBe("APIError");
    });
  });

  describe("NotFoundError", () => {
    it("should have 404 status", () => {
      const error = new NotFoundError();
      expect(error.status).toBe(404);
      expect(error.message).toBe("Resource not found");
      expect(error.name).toBe("NotFoundError");
    });

    it("should accept custom message", () => {
      const error = new NotFoundError("Voice not found");
      expect(error.message).toBe("Voice not found");
    });
  });

  describe("RateLimitError", () => {
    it("should have 429 status", () => {
      const error = new RateLimitError();
      expect(error.status).toBe(429);
      expect(error.message).toBe("Rate limit exceeded");
      expect(error.retryAfter).toBeUndefined();
    });

    it("should store retryAfter value", () => {
      const error = new RateLimitError("Too many requests", 60);
      expect(error.retryAfter).toBe(60);
    });
  });

  describe("InternalServerError", () => {
    it("should have default 500 status", () => {
      const error = new InternalServerError();
      expect(error.status).toBe(500);
      expect(error.message).toBe("Internal server error");
    });

    it("should accept custom status and message", () => {
      const error = new InternalServerError(503, "Service unavailable");
      expect(error.status).toBe(503);
      expect(error.message).toBe("Service unavailable");
    });
  });

  describe("WebSocketError", () => {
    it("should store error code", () => {
      const error = new WebSocketError("Connection failed", 1006);
      expect(error.message).toBe("Connection failed");
      expect(error.code).toBe(1006);
      expect(error.name).toBe("WebSocketError");
    });

    it("should work without code", () => {
      const error = new WebSocketError("Connection failed");
      expect(error.code).toBeUndefined();
    });
  });

  describe("TimeoutError", () => {
    it("should have default message", () => {
      const error = new TimeoutError();
      expect(error.message).toBe("Request timed out");
      expect(error.name).toBe("TimeoutError");
    });
  });

  describe("ConnectionError", () => {
    it("should have default message", () => {
      const error = new ConnectionError();
      expect(error.message).toBe("Failed to connect to the API");
      expect(error.name).toBe("ConnectionError");
    });
  });

  describe("handleAPIError", () => {
    it("should throw ValidationError for 422 responses", async () => {
      const response = createMockResponse({
        status: 422,
        body: {
          detail: [{ loc: ["body", "text"], msg: "required", type: "missing" }],
        },
      });

      await expect(handleAPIError(response)).rejects.toThrow(ValidationError);
    });

    it("should throw AuthenticationError for 401 responses", async () => {
      const response = createMockResponse({
        status: 401,
        body: { detail: "Invalid API key" },
      });

      await expect(handleAPIError(response)).rejects.toThrow(
        AuthenticationError
      );
    });

    it("should throw AuthenticationError for 403 responses", async () => {
      const response = createMockResponse({
        status: 403,
        body: { detail: "Forbidden" },
      });

      await expect(handleAPIError(response)).rejects.toThrow(
        AuthenticationError
      );
    });

    it("should throw NotFoundError for 404 responses", async () => {
      const response = createMockResponse({
        status: 404,
        body: { detail: "Voice not found" },
      });

      await expect(handleAPIError(response)).rejects.toThrow(NotFoundError);
    });

    it("should throw RateLimitError for 429 responses", async () => {
      const response = createMockResponse({
        status: 429,
        headers: { "retry-after": "60" },
        body: { detail: "Rate limit exceeded" },
      });

      try {
        await handleAPIError(response);
      } catch (e) {
        expect(e).toBeInstanceOf(RateLimitError);
        expect((e as RateLimitError).retryAfter).toBe(60);
      }
    });

    it("should throw InternalServerError for 5xx responses", async () => {
      const response = createMockResponse({
        status: 500,
        body: { detail: "Server error" },
      });

      await expect(handleAPIError(response)).rejects.toThrow(
        InternalServerError
      );
    });

    it("should throw APIError for other error status codes", async () => {
      const response = createMockResponse({
        status: 418,
        body: { detail: "I'm a teapot" },
      });

      await expect(handleAPIError(response)).rejects.toThrow(APIError);
    });
  });
});
