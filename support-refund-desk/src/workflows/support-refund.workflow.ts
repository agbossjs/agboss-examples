import {
  Workflow,
  WorkflowFinish,
  WorkflowStart,
  start,
} from "agboss";
import {
  LiveRefundSupportAgent,
  RefundSupportAgent,
} from "../agents/refund-support.agent.js";
import { InjectionDetectorService } from "../guardrails/prompt-injection.guardrail.js";
import { RefundPolicyToolInterceptor } from "../interceptors/refund-policy.interceptor.js";
import { PolicyDriftCompactionService } from "../memory/policy-aware.compaction.js";
import { SupportTicketIdPiiPolicy, TicketPatternService } from "../policies/support-ticket-id.policy.js";
import { OrderBookService } from "../tools/order-book.service.js";
import { SupportAnswerDto, SupportRequestDto } from "./dtos.js";

@WorkflowStart({
  name: "support-refund-workflow-start",
  description: "Incoming customer support refund request",
  input: SupportRequestDto,
})
export class SupportRefundWorkflowStart {}

@WorkflowFinish({
  name: "support-refund-workflow-finish",
  description: "Final support refund decision",
  output: SupportAnswerDto,
})
export class SupportRefundWorkflowFinish {}

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
  ],
})
export class SupportRefundWorkflow {}

@WorkflowStart({
  name: "live-support-refund-workflow-start",
  description: "Incoming customer support refund request (live OpenRouter openai/gpt-4o-mini)",
  input: SupportRequestDto,
})
export class LiveSupportRefundWorkflowStart {}

@WorkflowFinish({
  name: "live-support-refund-workflow-finish",
  description: "Final support refund decision (live OpenRouter openai/gpt-4o-mini)",
  output: SupportAnswerDto,
})
export class LiveSupportRefundWorkflowFinish {}

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
  ],
})
export class LiveSupportRefundWorkflow {}
