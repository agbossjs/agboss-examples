import { HttpAuthenticator, HttpAuthResult, HttpSecurity, type HttpAuthRequest } from "@agboss/core";
import { A2AOperation } from "@agboss/core/a2a";
import { BillingApiKeyDirectory } from "../services/billing-api-key-directory.service.js";

const READ_ONLY_OPERATIONS: ReadonlySet<string | undefined> = new Set<string>([
  A2AOperation.GetTask,
  A2AOperation.ListTasks,
  A2AOperation.SubscribeToTask,
]);

/** A read of tasks, or a message that starts a new one (it names no task). */
function isReadOrNewTask(request: HttpAuthRequest): boolean {
  if (READ_ONLY_OPERATIONS.has(request.operation)) return true;
  const isSend = request.operation === A2AOperation.SendMessage || request.operation === A2AOperation.SendStreamingMessage;
  return isSend && request.taskId === undefined;
}

/**
 * Who calls billing: decided by the host from the request's headers, never from its body. A key that is
 * unknown is `401`, a read-only key that answers a pause is `403`; a known one is its tenant and owner,
 * the triage gateway as the transport's peer (a signed mesh envelope of that peer makes the call trusted).
 */
@HttpAuthenticator({
  deps: [BillingApiKeyDirectory],
  schemes: [HttpSecurity.bearer()], // the card's securitySchemes
})
export class BillingHttpAuthenticator {
  constructor(private readonly billingApiKeyDirectory: BillingApiKeyDirectory) {}

  async authenticate(request: HttpAuthRequest): Promise<HttpAuthResult> {
    const authHeader: string = request.http.headers.authorization ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return HttpAuthResult.unauthenticated("Missing Bearer API key", {
        challenge: 'Bearer realm="billing-a2a"',
      });
    }
    const token = authHeader.slice("Bearer ".length).trim();
    const grant = await this.billingApiKeyDirectory.grantOf(token);
    if (grant === undefined) {
      return HttpAuthResult.unauthenticated("Unknown API key", {
        challenge: 'Bearer realm="billing-a2a"',
      });
    }
    // deny by default: a grant without canAnswerPauses may read (GetTask, ListTasks, SubscribeToTask) and start
    // a new task; any other operation, above all one that names a task (a resume by SendMessage or
    // SendStreamingMessage, a CancelTask), needs the right
    if (!grant.canAnswerPauses && !isReadOrNewTask(request)) {
      return HttpAuthResult.forbidden("This API key is not permitted to answer pauses or change a task");
    }
    return HttpAuthResult.authenticated({
      tenant: { tenantId: grant.tenantId },
      ownerId: grant.clientId,
      peer: "triage-gateway-application",
    });
  }
}
