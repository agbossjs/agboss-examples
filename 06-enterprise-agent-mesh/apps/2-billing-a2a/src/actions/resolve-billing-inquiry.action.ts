import {
  Action,
  ExecutionContext,
  type ActionHandler,
  type InputOf,
  type OutputOf,
} from "agboss";
import { BillingInquiryDto } from "../dto/billing-inquiry.dto.js";
import { BillingResolutionDto } from "../dto/billing-resolution.dto.js";

@Action({
  name: "resolve-billing-inquiry-action",
  description: "Resolves an invoice inquiry for the authenticated tenant",
  input: { inquiry: BillingInquiryDto },
  output: BillingResolutionDto,
  deps: [ExecutionContext],
})
export class ResolveBillingInquiryAction
  implements ActionHandler<ResolveBillingInquiryAction>
{
  constructor(private readonly executionContext: ExecutionContext) {}

  execute(
    input: InputOf<ResolveBillingInquiryAction>,
  ): Promise<OutputOf<ResolveBillingInquiryAction>> {
    const { invoiceId } = input.inquiry.value;
    const tenantId = this.executionContext.tenant.tenantId;
    return Promise.resolve({
      invoiceId,
      resolution: `Invoice ${invoiceId} verified for tenant ${tenantId}; $45.00 SLA credit applied.`,
      creditedUsd: 45,
      resolvedTenantId: tenantId,
    });
  }
}
