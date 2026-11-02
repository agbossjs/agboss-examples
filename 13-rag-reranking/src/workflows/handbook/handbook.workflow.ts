import { Workflow, start } from "@agboss/core";
import { WorkflowStartTextDto } from "@agboss/core/dto";
import { BriefingAgent } from "../../agents/briefing.agent.js";
import { HandbookAgent } from "../../agents/handbook.agent.js";
import { CohereClientService } from "../../services/cohere-client.service.js";
import { AnswerWorkflowFinish } from "./answer.workflow-finish.js";
import { BriefingWorkflowStart } from "./briefing.workflow-start.js";
import { HandbookWorkflowStart } from "./handbook.workflow-start.js";

/** Two starts on one knowledge base: the agent searches it, or is given its results first. */
@Workflow({
  name: "handbook-workflow",
  version: "1.0.0",
  flow: [
    start(HandbookWorkflowStart)
      .returns(WorkflowStartTextDto)
      .toAgent(HandbookAgent)
      .toFinish(AnswerWorkflowFinish),
    start(BriefingWorkflowStart)
      .returns(WorkflowStartTextDto)
      .toAgent(BriefingAgent)
      .toFinish(AnswerWorkflowFinish),
  ],
  defaults: { models: { temperature: 0 } },
  providers: [CohereClientService],
})
export class HandbookWorkflow {}
