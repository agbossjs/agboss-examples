import { Workflow, start } from "@agboss/core";
import { WorkflowStartTextDto } from "@agboss/core/dto";
import { StealthWebAgent } from "../../agents/stealth-web.agent.js";
import { AnswerWorkflowFinish } from "./answer.workflow-finish.js";
import { AskWorkflowStart } from "./ask.workflow-start.js";

/** Way A: the stealth browser as a `@Tool` with the shared browser injected. */
@Workflow({
  name: "stealth-workflow",
  version: "1.0.0",
  flow: [start(AskWorkflowStart)
.returns(WorkflowStartTextDto)
.toAgent(StealthWebAgent)
.toFinish(AnswerWorkflowFinish)],
  defaults: { models: { temperature: 0 } },
})
export class StealthWorkflow {}
