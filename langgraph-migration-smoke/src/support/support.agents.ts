import { Agent, historyOf, listOf, oneOf } from "agboss";
import {
  ChangesRequestedDto,
  RefundIssuedDto,
  ReplyApprovedDto,
  ReplyDraftDto,
  ResearchFindingDto,
  ResearchQuestionDto,
  SupportRequestDto,
} from "./support.dto.js";
import { IssueSignedOffRefundTool, OrderLookupTool } from "./support.tools.js";

@Agent({
  name: "research-planner-agent",
  description: "Lists what to check before answering",
  prompt: "List the questions to check before answering the customer about their order.",
  model: "moonshotai/kimi-k2.6",
  input: { request: SupportRequestDto },
  output: listOf(ResearchQuestionDto),
})
export class ResearchPlannerAgent {}

@Agent({
  name: "order-researcher-agent",
  description: "Answers one question from the order's facts",
  prompt: "Answer the question from the order's facts. Look the order up with order-lookup-tool.",
  model: "moonshotai/kimi-k2.6",
  input: { question: ResearchQuestionDto, request: SupportRequestDto },
  output: ResearchFindingDto,
  tools: [OrderLookupTool],
  maxToolCalls: 2,
})
export class OrderResearcherAgent {}

@Agent({
  name: "reply-writer-agent",
  description: "Writes the first reply from the findings",
  prompt: "Write a short, honest reply. Promise a refund only when the findings support one.",
  model: "moonshotai/kimi-k2.6",
  input: { request: SupportRequestDto, findings: listOf(ResearchFindingDto) },
  output: ReplyDraftDto,
})
export class ReplyWriterAgent {}

@Agent({
  name: "reply-reviewer-agent",
  description: "Approves the reply or asks for changes",
  prompt:
    "Approve the reply if the findings support every claim in it; otherwise say what to change. Do not ask again for what an earlier version fixed.",
  model: "moonshotai/kimi-k2.6",
  input: { draft: historyOf(ReplyDraftDto, { limit: 2 }), findings: listOf(ResearchFindingDto) },
  output: oneOf(ChangesRequestedDto, ReplyApprovedDto),
  maxVisits: 3,
})
export class ReplyReviewerAgent {}

@Agent({
  name: "reply-editor-agent",
  description: "Rewrites the reply as asked",
  prompt: "Rewrite the reply so it meets every requested change.",
  model: "moonshotai/kimi-k2.6",
  input: { draft: ReplyDraftDto, changes: ChangesRequestedDto },
  output: ReplyDraftDto,
  maxVisits: 2,
})
export class ReplyEditorAgent {}

@Agent({
  name: "refund-sign-off-agent",
  description: "Issues a large refund once it is signed off",
  prompt: "Issue the refund the reply promises with issue-signed-off-refund-tool, then report its id.",
  model: "moonshotai/kimi-k2.6",
  input: { request: SupportRequestDto, draft: ReplyDraftDto },
  output: RefundIssuedDto,
  tools: [IssueSignedOffRefundTool],
  maxToolCalls: 1,
})
export class RefundSignOffAgent {}
