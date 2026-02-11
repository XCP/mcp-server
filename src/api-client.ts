/**
 * HTTP client for communicating with a Counterparty node's REST API.
 */

const DEFAULT_TIMEOUT_MS = 30_000;

function extractErrorMessage(body: string): string {
  try {
    const json = JSON.parse(body);
    return json.error || json.message || body;
  } catch {
    return body;
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(baseUrl: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
    // Remove trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
  }

  /**
   * Make a GET request to the Counterparty API.
   * Always includes verbose=true to get normalized quantity fields.
   */
  async get(endpoint: string, params?: Record<string, unknown>): Promise<unknown> {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    // Always request verbose mode for normalized quantity fields
    url.searchParams.set('verbose', 'true');

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const message = extractErrorMessage(await response.text());
      throw new Error(`Counterparty API error (${response.status}): ${message}`);
    }

    return response.json();
  }

  /**
   * Make a POST request to the Counterparty API.
   * Counterparty uses query params for POST endpoints (not JSON body).
   */
  async post(endpoint: string, params: Record<string, unknown>): Promise<unknown> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const message = extractErrorMessage(await response.text());
      throw new Error(`Counterparty API error (${response.status}): ${message}`);
    }

    return response.json();
  }
}
