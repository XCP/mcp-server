/**
 * HTTP client for communicating with a Counterparty node's REST API.
 */
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    // Remove trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  /**
   * Make a GET request to the Counterparty API.
   */
  async get(endpoint: string, params?: Record<string, unknown>): Promise<unknown> {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      const body = await response.text();
      let message: string;
      try {
        const json = JSON.parse(body);
        message = json.error || json.message || body;
      } catch {
        message = body;
      }
      throw new Error(`Counterparty API error (${response.status}): ${message}`);
    }

    return response.json();
  }

  /**
   * Make a POST request to the Counterparty API.
   */
  async post(endpoint: string, body: unknown): Promise<unknown> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      let message: string;
      try {
        const json = JSON.parse(text);
        message = json.error || json.message || text;
      } catch {
        message = text;
      }
      throw new Error(`Counterparty API error (${response.status}): ${message}`);
    }

    return response.json();
  }

  /**
   * Make a compose request (GET with verbose=true).
   */
  async compose(endpoint: string, params?: Record<string, unknown>): Promise<unknown> {
    return this.get(endpoint, { ...params, verbose: true });
  }
}
