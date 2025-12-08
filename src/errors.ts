import type { HTTPValidationError, ValidationErrorDetail } from "./types";

/**
 * Base error class for all Gradium API errors
 */
export class GradiumError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GradiumError";
    Object.setPrototypeOf(this, GradiumError.prototype);
  }
}

/**
 * Error thrown when the API key is missing or invalid
 */
export class AuthenticationError extends GradiumError {
  constructor(message = "Invalid or missing API key") {
    super(message);
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Error thrown when the API returns a validation error (422)
 */
export class ValidationError extends GradiumError {
  readonly status: number = 422;
  readonly errors: ValidationErrorDetail[];

  constructor(errors: ValidationErrorDetail[], message?: string) {
    const errorMessage = message || ValidationError.formatErrors(errors);
    super(errorMessage);
    this.name = "ValidationError";
    this.errors = errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }

  private static formatErrors(errors: ValidationErrorDetail[]): string {
    return errors.map((e) => `${e.loc.join(".")}: ${e.msg}`).join("; ");
  }
}

/**
 * Error thrown when the API returns a 4xx error (except 422)
 */
export class APIError extends GradiumError {
  readonly status: number;
  readonly body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.body = body;
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

/**
 * Error thrown when the API returns a 404 error
 */
export class NotFoundError extends APIError {
  constructor(message = "Resource not found") {
    super(404, message);
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Error thrown when the API returns a 429 error (rate limit)
 */
export class RateLimitError extends APIError {
  readonly retryAfter?: number;

  constructor(message = "Rate limit exceeded", retryAfter?: number) {
    super(429, message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Error thrown when the API returns a 5xx error
 */
export class InternalServerError extends APIError {
  constructor(status = 500, message = "Internal server error") {
    super(status, message);
    this.name = "InternalServerError";
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

/**
 * Error thrown when a WebSocket connection fails
 */
export class WebSocketError extends GradiumError {
  readonly code?: number;

  constructor(message: string, code?: number) {
    super(message);
    this.name = "WebSocketError";
    this.code = code;
    Object.setPrototypeOf(this, WebSocketError.prototype);
  }
}

/**
 * Error thrown when a request times out
 */
export class TimeoutError extends GradiumError {
  constructor(message = "Request timed out") {
    super(message);
    this.name = "TimeoutError";
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Error thrown when a connection fails
 */
export class ConnectionError extends GradiumError {
  constructor(message = "Failed to connect to the API") {
    super(message);
    this.name = "ConnectionError";
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}

/**
 * Parse an API response and throw the appropriate error
 */
export async function handleAPIError(response: Response): Promise<never> {
  const status = response.status;
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    body = await response.text().catch(() => null);
  }

  // Handle validation errors (422)
  if (status === 422 && body && typeof body === "object" && "detail" in body) {
    const validationError = body as HTTPValidationError;
    throw new ValidationError(validationError.detail);
  }

  // Handle authentication errors (401, 403)
  if (status === 401 || status === 403) {
    const message =
      typeof body === "object" && body && "detail" in body
        ? String((body as { detail: string }).detail)
        : "Authentication failed";
    throw new AuthenticationError(message);
  }

  // Handle not found (404)
  if (status === 404) {
    const message =
      typeof body === "object" && body && "detail" in body
        ? String((body as { detail: string }).detail)
        : "Resource not found";
    throw new NotFoundError(message);
  }

  // Handle rate limit (429)
  if (status === 429) {
    const retryAfter = response.headers.get("retry-after");
    const message =
      typeof body === "object" && body && "detail" in body
        ? String((body as { detail: string }).detail)
        : "Rate limit exceeded";
    throw new RateLimitError(
      message,
      retryAfter ? Number.parseInt(retryAfter, 10) : undefined
    );
  }

  // Handle server errors (5xx)
  if (status >= 500) {
    const message =
      typeof body === "object" && body && "detail" in body
        ? String((body as { detail: string }).detail)
        : `Server error (${status})`;
    throw new InternalServerError(status, message);
  }

  // Handle other errors
  const message =
    typeof body === "object" && body && "detail" in body
      ? String((body as { detail: string }).detail)
      : `API error (${status})`;
  throw new APIError(status, message, body);
}
