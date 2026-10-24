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
import {
  OrderResearcherAgent,
  RefundSignOffAgent,
  ReplyEditorAgent,
  ReplyReviewerAgent,
  ReplyWriterAgent,
  ResearchPlannerAgent,
} from "./support.agents.js";
import {
  ChangesRequestedDto,
  RefundIssuedDto,
  ReplyApprovedDto,
  ReplyDraftDto,
  ResearchFindingDto,
  ResearchQuestionDto,
  SupportRequestDto,
} from "./support.dto.js";
import {
  HandOverWorkflowFinish,
  IssueRefundAction,
  RefundIssuedWorkflowFinish,
  RefundSizeRouter,
  ReplyStuckWorkflowFinish,
  SupportTriageRouter,
  SupportWorkflowStart,
} from "./support.nodes.js";
import { OrderBookService, RefundApiService } from "./support.services.js";

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
