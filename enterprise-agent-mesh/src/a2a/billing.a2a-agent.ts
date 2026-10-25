import { ExecutionContext } from "agboss";
import { A2AAgent, A2AClient } from "agboss/a2a";
import { usd } from "agboss/units";
import { BillingInquiryDto } from "../dto/billing-inquiry.dto.js";
import { BillingResolutionDto } from "../dto/billing-resolution.dto.js";

let activeBillingBaseUrl = "http://127.0.0.1:8081/a2a";
let activeBillingApiKey = "key-acme";
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

export function getActiveBillingBaseUrl(): string {
  return activeBillingBaseUrl;
}

export function getActiveBillingApiKey(): string {
  return activeBillingApiKey;
}

export function getCustomA2aHeaders(): Record<string, string> {
  return customA2aHeaders;
}

@A2AAgent({
  name: "billing-a2a-agent",
  url: "http://127.0.0.1:8081/a2a",
  target: {
    application: "billing-application",
    start: "billing-workflow-start",
  },
  input: BillingInquiryDto,
  output: BillingResolutionDto,
  price: usd(0.002),
  deps: [ExecutionContext],
})
export class BillingA2AAgent extends A2AClient<BillingInquiryDto, BillingResolutionDto> {
  constructor(private readonly executionContext: ExecutionContext) {
    super();
  }

  protected override getHeaders(): Promise<Record<string, string>> {
    void this.executionContext.tenant.tenantId;
    return Promise.resolve({
      authorization: `Bearer ${activeBillingApiKey}`,
      ...customA2aHeaders,
    });
  }
}
