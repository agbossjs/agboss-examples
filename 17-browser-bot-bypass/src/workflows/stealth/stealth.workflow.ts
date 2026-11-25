import { Workflow, onStart, Ttl } from "@agboss/core";
import { StealthWebAgent } from "../../agents/stealth-web.agent.js";
import { AnswerWorkflowFinish } from "./answer.workflow-finish.js";
import { AskWorkflowStart } from "./ask.workflow-start.js";

/** Way A: the stealth browser as a `@Tool` with the shared browser injected. */
@Workflow({
  name: "stealth-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [onStart(AskWorkflowStart)
.toAgent(StealthWebAgent)
.toFinish(AnswerWorkflowFinish)],
  defaults: { models: { temperature: 0 } },
})
export class StealthWorkflow {}
