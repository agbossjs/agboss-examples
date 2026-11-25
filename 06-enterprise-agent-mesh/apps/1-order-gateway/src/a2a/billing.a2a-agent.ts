import { bearer, secret } from "@agboss/core";
import { A2AAgent, A2AClient, A2AMesh } from "@agboss/core/a2a";
import { usd } from "@agboss/core/units";
import { BillingInquiryDto } from "../dto/billing-inquiry.dto.js";
import { BillingResolutionDto } from "../dto/billing-resolution.dto.js";

let activeBillingBaseUrl = "http://127.0.0.1:8081/a2a";
let activeBillingApiKey: string | undefined;
let customA2aHeaders: Record<string, string> = {};

export function configureTriageMeshTarget(options: {
  readonly billingUrl?: string;
  readonly apiKey?: string;
  readonly extraHeaders?: Readonly<Record<string, string>>;
}): void {
  if (options.billingUrl !== undefined) {
    activeBillingBaseUrl = options.billingUrl;
  }
  if (options.apiKey !== undefined) {
    activeBillingApiKey = options.apiKey;
  }
  customA2aHeaders = { ...(options.extraHeaders ?? {}) };
}

export function getActiveBillingApiKey(): string | undefined {
  return activeBillingApiKey;
}

export function getActiveBillingBaseUrl(): string {
  return activeBillingBaseUrl;
}

export function getCustomA2aHeaders(): Record<string, string> {
  return customA2aHeaders;
}

@A2AAgent({
  name: "billing-a2a-agent",
  url: "http://127.0.0.1:8081/a2a",
  target: {
    application: "billing-application",
    skill: "billing-workflow-start",
  },
  input: BillingInquiryDto,
  output: BillingResolutionDto,
  costPerCall: usd(0.002),
  // the mesh (call chain, budget, deadline, signed run report) rides as the extension
  // https://agboss.dev/a2a/mesh/v1: Required is the default for an AGBoss peer, said here on purpose
  mesh: A2AMesh.Required,
  // what the gateway presents to billing: a secret reference, read once when the application starts
  headers: { authorization: bearer(secret("BILLING_API_KEY")) },
})
export class BillingA2AAgent extends A2AClient<BillingInquiryDto, BillingResolutionDto> {
  /** A test points the gateway at its own billing server and key; with none set, the declared header is the key. */
  protected override getHeaders(): Promise<Record<string, string>> {
    return Promise.resolve({
      ...(activeBillingApiKey === undefined ? {} : { authorization: `Bearer ${activeBillingApiKey}` }),
      ...customA2aHeaders,
    });
  }
}
