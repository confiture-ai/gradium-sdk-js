import type { Gradium } from "../client";
import { handleAPIError } from "../errors";
import type { CreditsSummary } from "../types";

/**
 * Credits resource for monitoring API credit balance
 */
export class Credits {
  private readonly client: Gradium;

  constructor(client: Gradium) {
    this.client = client;
  }

  /**
   * Get the current credit balance for the authenticated user's subscription
   *
   * @example
   * ```ts
   * const credits = await client.credits.get();
   * console.log(`Remaining: ${credits.remaining_credits}/${credits.allocated_credits}`);
   * console.log(`Plan: ${credits.plan_name}`);
   * console.log(`Next rollover: ${credits.next_rollover_date}`);
   * ```
   */
  async get(): Promise<CreditsSummary> {
    const response = await fetch(`${this.client.baseURL}/usages/credits`, {
      method: "GET",
      headers: this.client.headers,
    });

    if (!response.ok) {
      await handleAPIError(response);
    }

    return response.json();
  }
}
