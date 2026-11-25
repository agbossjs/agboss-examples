import { PauseRespondent, ToolApproval } from "@agboss/core";
import { hours } from "@agboss/core/units";

/**
 * The user approves the write of their shortlist before it happens (what used to be the terminal
 * channel): the thread's owner answers (`PauseRespondent.Owner`), and there is no channel — the chat
 * (`agboss chat`, the demo's `app.resume`) shows the pending approval and answers it.
 */
@ToolApproval({
  name: "save-shortlist-tool-approval",
  description: "The user approves saving their shortlist",
  respondent: PauseRespondent.Owner,
  timeout: hours(24),
})
export class SaveShortlistToolApproval {}
