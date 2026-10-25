import {
  VisitsLimitExceededError,
  Workflow,
  agent,
  caseOf,
  listOf,
  oneOf,
  route,
  start,
  toFinish,
} from "agboss";
import { IssueRefundAction } from "../../actions/issue-refund.action.js";
import { OrderResearcherAgent } from "../../agents/order-researcher/order-researcher.agent.js";
import { RefundSignOffAgent } from "../../agents/refund-sign-off/refund-sign-off.agent.js";
import { ReplyEditorAgent } from "../../agents/reply-editor/reply-editor.agent.js";
import { ReplyReviewerAgent } from "../../agents/reply-reviewer/reply-reviewer.agent.js";
import { ReplyWriterAgent } from "../../agents/reply-writer/reply-writer.agent.js";
import { ResearchPlannerAgent } from "../../agents/research-planner/research-planner.agent.js";
import { ChangesRequestedDto } from "../../dto/changes-requested.dto.js";
import { RefundIssuedDto } from "../../dto/refund-issued.dto.js";
import { ReplyApprovedDto } from "../../dto/reply-approved.dto.js";
import { ReplyDraftDto } from "../../dto/reply-draft.dto.js";
import { ResearchFindingDto } from "../../dto/research-finding.dto.js";
import { ResearchQuestionDto } from "../../dto/research-question.dto.js";
import { SupportRequestDto } from "../../dto/support-request.dto.js";
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
  flow: [
    start(SupportWorkflowStart)
      .returns(SupportRequestDto)
      .toRouter(SupportTriageRouter)
      .chooseOne(
        route(ResearchPlannerAgent)
          .returns(listOf(ResearchQuestionDto))
          .toParallelAgents(OrderResearcherAgent, { maxConcurrency: 3, maxItems: 5 })
          .join()
          .returns(listOf(ResearchFindingDto))
          .toAgent(ReplyWriterAgent)
          .returns(ReplyDraftDto)
          .toAgent(ReplyReviewerAgent),
        route(HandOverWorkflowFinish),
      ),

    agent(ReplyReviewerAgent)
      .returns(oneOf(ChangesRequestedDto, ReplyApprovedDto))
      .switch(
        caseOf(ChangesRequestedDto, { about: ReplyDraftDto })
          .toAgent(ReplyEditorAgent)
          .onError(VisitsLimitExceededError, toFinish(ReplyStuckWorkflowFinish))
          .returns(ReplyDraftDto)
          .toAgent(ReplyReviewerAgent),
        caseOf(ReplyApprovedDto)
          .toRouter(RefundSizeRouter)
          .chooseOne(
            route(IssueRefundAction)
              .returns(RefundIssuedDto)
              .toFinish(RefundIssuedWorkflowFinish),
            route(RefundSignOffAgent)
              .returns(RefundIssuedDto)
              .toFinish(RefundIssuedWorkflowFinish),
          ),
      ),
  ],
  maxSteps: 16,
  providers: [OrderBookService, RefundApiService],
})
export class SupportWorkflow {}
