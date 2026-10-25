import { DecidedBy, Router } from "agboss";
import { ResearchPlannerAgent } from "../../agents/research-planner/research-planner.agent.js";
import { SupportRequestDto } from "../../dto/support-request.dto.js";
import { HandOverWorkflowFinish } from "../../workflow-finishes/hand-over.workflow-finish.js";

@Router({
  name: "support-triage-router",
  description: "Sends a refund request on, hands anything else over",
  decidedBy: DecidedBy.Model,
  promptUrls: ["./support-triage.prompt.md"],
  model: "openai/gpt-4o-mini",
  input: { request: SupportRequestDto },
  routes: [
    { prompt: "The customer asks for a refund", target: ResearchPlannerAgent },
    {
      prompt: "Stop and hand the message over: it is not about a refund",
      target: HandOverWorkflowFinish,
    },
  ],
})
export class SupportTriageRouter {}
