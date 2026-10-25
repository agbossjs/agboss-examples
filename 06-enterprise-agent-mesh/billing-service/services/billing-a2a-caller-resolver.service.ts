import { Injectable } from "agboss";
import {
  A2ACallerResolution,
  A2ARoute,
  type A2ACallerRequest,
  type A2ACallerResolver,
} from "agboss/a2a";
import type { BillingWorkflowStart } from "../workflow-starts/billing.workflow-start.js";
import { BillingApiKeyDirectory } from "./billing-api-key-directory.service.js";

@Injectable({ deps: [BillingApiKeyDirectory] })
export class BillingA2aCallerResolver
  implements A2ACallerResolver<typeof BillingWorkflowStart>
{
  constructor(private readonly billingApiKeyDirectory: BillingApiKeyDirectory) {}

  async resolveCaller(
    request: A2ACallerRequest,
  ): Promise<A2ACallerResolution<typeof BillingWorkflowStart>> {
    const authHeader: string = request.http.headers.authorization ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return A2ACallerResolution.unauthenticated({
        reason: "Missing Bearer API key",
        challenge: 'Bearer realm="billing-a2a"',
      });
    }
    const token = authHeader.slice("Bearer ".length).trim();
    const grant = await this.billingApiKeyDirectory.grantOf(token);
    if (grant === undefined) {
      return A2ACallerResolution.unauthenticated({
        reason: "Unknown API key",
        challenge: 'Bearer realm="billing-a2a"',
      });
    }
    if (request.route === A2ARoute.Resume && !grant.canAnswerPauses) {
      return A2ACallerResolution.forbidden({
        reason: "This API key is not permitted to answer pauses",
      });
    }
    return A2ACallerResolution.resolved({
      tenant: { tenantId: grant.tenantId },
      ownerId: grant.clientId,
      peer: "triage-gateway-application",
    });
  }
}
