import { Workflow, start } from "@agboss/core";
import { LiveRefundSupportAgent } from "../../agents/live-refund-support/live-refund-support.agent.js";
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
import { LiveSupportRefundWorkflowFinish } from "./live-support-refund.workflow-finish.js";
import { LiveSupportRefundWorkflowStart } from "./live-support-refund.workflow-start.js";

@Workflow({
  name: "live-support-refund-workflow",
  version: "1.0.0",
  flow: [
    start(LiveSupportRefundWorkflowStart)
      .returns(SupportRequestDto)
      .toAgent(LiveRefundSupportAgent)
      .returns(SupportAnswerDto)
      .toFinish(LiveSupportRefundWorkflowFinish),
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
export class LiveSupportRefundWorkflow {}
