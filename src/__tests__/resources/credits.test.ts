import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { Gradium } from "../../client";
import { AuthenticationError } from "../../errors";
import { createMockResponse } from "../mocks/fetch";

describe("Credits Resource", () => {
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

  describe("get", () => {
    it("should get credit summary", async () => {
      const mockCredits = {
        remaining_credits: 5000,
        allocated_credits: 10_000,
        billing_period: "2024-01",
        next_rollover_date: "2024-02-01",
        plan_name: "Professional",
      };

      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        createMockResponse({ status: 200, body: mockCredits })
      );

      const credits = await client.credits.get();

      expect(credits).toEqual(mockCredits);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://eu.api.gradium.ai/api/usages/credits");
      expect(options?.method).toBe("GET");
      expect(options?.headers).toHaveProperty("x-api-key", "test-api-key");
    });

    it("should handle authentication errors", async () => {
      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        createMockResponse({
          status: 401,
          body: { detail: "Invalid API key" },
        })
      );

      await expect(client.credits.get()).rejects.toThrow(AuthenticationError);
    });

    it("should handle missing optional fields", async () => {
      const mockCredits = {
        remaining_credits: 1000,
        allocated_credits: 5000,
        billing_period: "2024-01",
      };

      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        createMockResponse({ status: 200, body: mockCredits })
      );

      const credits = await client.credits.get();

      expect(credits.remaining_credits).toBe(1000);
      expect(credits.allocated_credits).toBe(5000);
      expect(credits.next_rollover_date).toBeUndefined();
      expect(credits.plan_name).toBeUndefined();
    });
  });
});
