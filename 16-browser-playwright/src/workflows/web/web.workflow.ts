import { Workflow, onStart, Ttl } from "@agboss/core";
import { SubmitContactAction } from "../../actions/submit-contact.action.js";
import { WebAgent } from "../../agents/web.agent.js";
import { ScreenshotFilePolicy } from "../../file-policies/screenshot.file-policy.js";
import { AnswerWorkflowFinish } from "./answer.workflow-finish.js";
import { AskWorkflowStart } from "./ask.workflow-start.js";
import { ContactWorkflowFinish } from "./contact.workflow-finish.js";
import { ContactWorkflowStart } from "./contact.workflow-start.js";

/**
 * Way A: plain Playwright. One start gives a request to the agent, whose tools use the shared
 * browser; the other files a contact request with no model at all (the crash tests' path).
 */
@Workflow({
  name: "web-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  filePolicy: ScreenshotFilePolicy,
  flow: [
    onStart(AskWorkflowStart)
.toAgent(WebAgent)
.toFinish(AnswerWorkflowFinish),
    onStart(ContactWorkflowStart)
.toAction(SubmitContactAction)
.toFinish(ContactWorkflowFinish),
  ],
  defaults: { models: { temperature: 0 } },
})
export class WebWorkflow {}
