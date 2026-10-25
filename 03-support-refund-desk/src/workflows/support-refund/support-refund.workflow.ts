import { Workflow, start } from "agboss";
import { RefundSupportAgent } from "../../agents/refund-support/refund-support.agent.js";
import { SupportAnswerDto } from "../../dto/support-answer.dto.js";
import { SupportRequestDto } from "../../dto/support-request.dto.js";
import { RefundPolicyToolInterceptor } from "../../interceptors/refund-policy.interceptor.js";
import { SupportTicketIdPiiPolicy } from "../../pii-policies/support-ticket-id.pii-policy.js";
import { RefundPolicyRetriever } from "../../retrievers/refund-policy.retriever.js";
import { InMemoryKnowledgeIndexService } from "../../services/in-memory-knowledge-index.service.js";
import { InjectionDetectorService } from "../../services/injection-detector.service.js";
import { OrderBookService } from "../../services/order-book.service.js";
import { PolicyDriftCompactionService } from "../../services/policy-drift-compaction.service.js";
import { TicketPatternService } from "../../services/ticket-pattern.service.js";
import { SupportRefundWorkflowFinish } from "./support-refund.workflow-finish.js";
import { SupportRefundWorkflowStart } from "./support-refund.workflow-start.js";

@Workflow({
  name: "support-refund-workflow",
  version: "1.0.0",
  flow: [
    start(SupportRefundWorkflowStart)
      .returns(SupportRequestDto)
      .toAgent(RefundSupportAgent)
      .returns(SupportAnswerDto)
      .toFinish(SupportRefundWorkflowFinish),
  ],
  maxSteps: 4,
  piiPolicies: [SupportTicketIdPiiPolicy],
  toolInterceptors: [RefundPolicyToolInterceptor],
  providers: [
    OrderBookService,
    TicketPatternService,
    InjectionDetectorService,
    PolicyDriftCompactionService,
    InMemoryKnowledgeIndexService,
    RefundPolicyRetriever,
  ],
})
export class SupportRefundWorkflow {}
