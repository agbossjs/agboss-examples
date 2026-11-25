import { Workflow, onStart, Ttl } from "@agboss/core";
import { BriefingAgent } from "../../agents/briefing.agent.js";
import { HandbookAgent } from "../../agents/handbook.agent.js";
import { HandbookRag } from "../../rag/handbook.rag.js";
import { CohereClientService } from "../../services/cohere-client.service.js";
import { AnswerWorkflowFinish } from "./answer.workflow-finish.js";
import { BriefingWorkflowStart } from "./briefing.workflow-start.js";
import { HandbookWorkflowStart } from "./handbook.workflow-start.js";

/** Two starts on one knowledge base: the agent searches it, or is given its results first. */
@Workflow({
  name: "handbook-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(HandbookWorkflowStart)
      .toAgent(HandbookAgent)
      .toFinish(AnswerWorkflowFinish),
    onStart(BriefingWorkflowStart)
      .toAgent(BriefingAgent)
      .toFinish(AnswerWorkflowFinish),
  ],
  defaults: { models: { temperature: 0 } },
  providers: [CohereClientService, HandbookRag], // the knowledge base a tool injects is listed here
})
export class HandbookWorkflow {}
