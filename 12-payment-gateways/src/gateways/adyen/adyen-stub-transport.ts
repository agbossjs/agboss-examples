// Independent example, not affiliated (see adyen.gateway-payments.ts).
import { HttpClientException, type Config } from "@adyen/api-library";
import type { IRequest } from "@adyen/api-library/lib/src/typings/requestOptions.js";

/**
 * How the SDK reaches the stub — not part of the wiring you copy: the library's README says "you can
 * set a custom HttpClient for your Client object"; this one sends Adyen's own request (its endpoint,
 * JSON and `idempotency-key`) to the stub instead of checkout-test.adyen.com. In production you
 * leave the default client.
 */
export class StubHttpClient {
  constructor(private readonly baseUrl: string) {}

  async request(endpoint: string, json: string | Buffer, config: Config, _isApiKeyRequired: boolean, options: IRequest.Options = {}): Promise<string> {
    const headers: Record<string, string> = { "content-type": "application/json", "x-api-key": config.apiKey ?? "" };
    if (options.idempotencyKey !== undefined) headers["idempotency-key"] = options.idempotencyKey; // never dropped, not even on 703
    const response = await fetch(endpoint.replace(/^https:\/\/[^/]+/u, this.baseUrl), { method: "POST", headers, body: json.toString() });
    const body = await response.text();
    if (!response.ok) throw new HttpClientException({ message: `HTTP Exception: ${String(response.status)}`, statusCode: response.status, responseBody: body });
    return body;
  }
}

