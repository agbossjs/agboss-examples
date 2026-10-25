import { ExecutionContext, Tool, type ToolHandler } from "agboss";
import { A2AClient } from "agboss/a2a";
import { seconds } from "agboss/units";
import {
  BillingA2AAgent,
  getActiveBillingApiKey,
  getActiveBillingBaseUrl,
  getCustomA2aHeaders,
} from "../a2a/billing.a2a-agent.js";
import { BillingInquiryDto } from "../dto/billing-inquiry.dto.js";
import { BillingResolutionDto } from "../dto/billing-resolution.dto.js";

@Tool({
  name: "ask-billing-tool",
  description: "Delegates invoice resolution to BillingApplication over A2A",
  input: BillingInquiryDto,
  output: BillingResolutionDto,
  timeout: seconds(30),
  deps: [BillingA2AAgent, ExecutionContext],
})
export class AskBillingTool implements ToolHandler<BillingInquiryDto, BillingResolutionDto> {
  constructor(
    private readonly billingA2AAgent: BillingA2AAgent,
    private readonly executionContext: ExecutionContext,
  ) {}

  run(inquiry: BillingInquiryDto): Promise<BillingResolutionDto> {
    const activeBillingBaseUrl = getActiveBillingBaseUrl();
    const client =
      activeBillingBaseUrl === "http://127.0.0.1:8081/a2a"
        ? this.billingA2AAgent
        : new A2AClient<BillingInquiryDto, BillingResolutionDto>({
            url: activeBillingBaseUrl,
            contract: {
              target: {
                application: "billing-application",
                start: "billing-workflow-start",
              },
              input: BillingInquiryDto,
              output: BillingResolutionDto,
            },
            headers: {
              authorization: `Bearer ${getActiveBillingApiKey()}`,
              ...getCustomA2aHeaders(),
            },
          });
    return client.execute(inquiry, { signal: this.executionContext.signal });
  }
}
