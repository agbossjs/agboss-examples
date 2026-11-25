import { VisitsLimitExceededError, Workflow, toFinish, onStart, onAgent, toAgent, toRouter, toAction, Ttl } from "@agboss/core";
import { IssueRefundAction } from "../../actions/issue-refund.action.js";
import { OrderResearcherAgent } from "../../agents/order-researcher/order-researcher.agent.js";
import { RefundSignOffAgent } from "../../agents/refund-sign-off/refund-sign-off.agent.js";
import { ReplyEditorAgent } from "../../agents/reply-editor/reply-editor.agent.js";
import { ReplyReviewerAgent } from "../../agents/reply-reviewer/reply-reviewer.agent.js";
import { ReplyWriterAgent } from "../../agents/reply-writer/reply-writer.agent.js";
import { ResearchPlannerAgent } from "../../agents/research-planner/research-planner.agent.js";
import { RefundSizeRouter } from "../../routers/refund-size/refund-size.router.js";
import { SupportTriageRouter } from "../../routers/support-triage/support-triage.router.js";
import { OrderBookService } from "../../services/order-book.service.js";
import { RefundApiService } from "../../services/refund-api.service.js";
import { HandOverWorkflowFinish } from "./hand-over.workflow-finish.js";
import { RefundIssuedWorkflowFinish } from "./refund-issued.workflow-finish.js";
import { ReplyStuckWorkflowFinish } from "./reply-stuck.workflow-finish.js";
import { SupportWorkflowStart } from "./support.workflow-start.js";

@Workflow({
  name: "support-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(SupportWorkflowStart)
      .toRouter(SupportTriageRouter)
      .onRoute(toAgent(ResearchPlannerAgent)
          .forEachItem(toAgent(OrderResearcherAgent), { maxConcurrency: 3, takeFirst: 5 })
          .join()
          .toAgent(ReplyWriterAgent)
          .toAgent(ReplyReviewerAgent))
      .onRoute(toFinish(HandOverWorkflowFinish)),

    onAgent(ReplyReviewerAgent)
      .toOneOf([toAgent(ReplyEditorAgent)
          .onError(VisitsLimitExceededError, toFinish(ReplyStuckWorkflowFinish))
          .toAgent(ReplyReviewerAgent), toRouter(RefundSizeRouter)
          .onRoute(toAction(IssueRefundAction)
              .toFinish(RefundIssuedWorkflowFinish))
          .onRoute(toAgent(RefundSignOffAgent)
              .toFinish(RefundIssuedWorkflowFinish))]),
  ],
  providers: [OrderBookService, RefundApiService],
  executionLimits: { maxSteps: 16 },
})
export class SupportWorkflow {}
