import { Agent, listOf } from "agboss";
import { ResearchQuestionDto } from "../../dto/research-question.dto.js";
import { SupportRequestDto } from "../../dto/support-request.dto.js";

@Agent({
  name: "research-planner-agent",
  description: "Lists what to check before answering",
  promptUrls: ["./research-planner.prompt.md"],
  model: "openai/gpt-4o-mini",
  input: { request: SupportRequestDto },
  output: listOf(ResearchQuestionDto),
})
export class ResearchPlannerAgent {}
