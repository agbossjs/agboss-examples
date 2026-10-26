import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { ApplicationContext, ExecutionContext, Injectable } from "@agboss/core";
import type { QuoteCalculationOutputDto } from "../dto/quote-calculation-output.dto.js";

const TIER_RATES: Readonly<Record<string, number>> = {
  starter: 29,
  pro: 79,
  enterprise: 199,
};

/**
 * Pure domain calculation used by the local stub HTTP API server (and fallback).
 */
export function computeTierQuote(
  tierInput: string,
  seats: number,
  currency: string,
): QuoteCalculationOutputDto {
  const normalizedTier = tierInput.trim().toLowerCase();
  const unitPrice = TIER_RATES[normalizedTier] ?? TIER_RATES["pro"] ?? 79;
  const volumeDiscountApplied = seats >= 10;
  const multiplier = volumeDiscountApplied ? 0.85 : 1;
  const monthlyTotalUsd = Math.round(unitPrice * seats * multiplier * 100) / 100;

  return {
    tier: normalizedTier in TIER_RATES ? normalizedTier : "pro",
    seats,
    monthlyTotalUsd,
    volumeDiscountApplied,
    currency,
  };
}

export interface PricingApiRequestRecord {
  readonly method: string;
  readonly url: string;
  readonly idempotencyKey: string | undefined;
  readonly authorization: string | undefined;
  readonly body: { readonly tier: string; readonly seats: number; readonly currency?: string };
}

export interface PricingApiStubServer {
  readonly baseUrl: string;
  readonly requests: PricingApiRequestRecord[];
  close(): Promise<void>;
}

/**
 * Starts a lightweight local `node:http` pricing catalog server on `127.0.0.1:0`
 * so `PricingCatalogService` executes real `fetch()` HTTP calls 100% offline.
 */
export async function startPricingApiStubServer(): Promise<PricingApiStubServer> {
  const requests: PricingApiRequestRecord[] = [];
  const idempotentCache = new Map<string, QuoteCalculationOutputDto>();

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (req.method === "POST" && req.url === "/quotes") {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        const parsed = JSON.parse(raw) as {
          tier: string;
          seats: number;
          currency?: string;
        };
        const idempotencyKey =
          typeof req.headers["idempotency-key"] === "string"
            ? req.headers["idempotency-key"]
            : undefined;
        const authorization =
          typeof req.headers.authorization === "string"
            ? req.headers.authorization
            : undefined;

        requests.push({
          method: req.method ?? "POST",
          url: req.url ?? "/quotes",
          idempotencyKey,
          authorization,
          body: parsed,
        });

        const existing = idempotencyKey ? idempotentCache.get(idempotencyKey) : undefined;
        const quote =
          existing ??
          computeTierQuote(parsed.tier, parsed.seats, parsed.currency ?? "USD");
        if (idempotencyKey && !existing) {
          idempotentCache.set(idempotencyKey, quote);
        }

        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(quote));
      });
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      }),
  };
}

/**
 * Domain service injected into CalculateQuoteTool via constructor DI.
 * Demonstrates:
 * - `deps: [ApplicationContext, ExecutionContext]`
 * - Reading `pricingApiBaseUrl`, `catalogCurrency`, and `openRouterApiKey` from `ApplicationContext.environment`
 * - Validating endpoint configuration and reachability in `async onInit()`
 * - Passing `signal: this.executionContext.signal` and `"Idempotency-Key": this.executionContext.step.idempotencyKey` to `fetch()`
 */
@Injectable({ deps: [ApplicationContext, ExecutionContext] })
export class PricingCatalogService {
  constructor(
    private readonly applicationContext: ApplicationContext,
    private readonly executionContext: ExecutionContext,
  ) {}

  async onInit(): Promise<void> {
    const baseUrl = this.applicationContext.environment.pricingApiBaseUrl.trim();
    if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
      throw new Error(`Invalid pricingApiBaseUrl: ${baseUrl}`);
    }
    if (baseUrl.startsWith("http://127.0.0.1:") || baseUrl.startsWith("http://localhost:")) {
      const response = await fetch(`${baseUrl}/health`);
      if (!response.ok) {
        throw new Error(
          `Pricing API health check failed with HTTP ${String(response.status)}`,
        );
      }
    }
  }

  async fetchQuote(tierInput: string, seats: number): Promise<QuoteCalculationOutputDto> {
    const baseUrl = this.applicationContext.environment.pricingApiBaseUrl.replace(/\/+$/u, "");
    const response = await fetch(`${baseUrl}/quotes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${String(this.applicationContext.environment.openRouterApiKey)}`,
        "Idempotency-Key": this.executionContext.step.idempotencyKey,
      },
      body: JSON.stringify({
        tier: tierInput,
        seats,
        currency: this.applicationContext.environment.catalogCurrency,
      }),
      signal: this.executionContext.signal,
    });

    if (!response.ok) {
      throw new Error(`Pricing API request failed with HTTP ${String(response.status)}`);
    }

    return (await response.json()) as QuoteCalculationOutputDto;
  }
}
