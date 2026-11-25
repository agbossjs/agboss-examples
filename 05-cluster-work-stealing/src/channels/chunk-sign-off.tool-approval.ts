import { PauseRespondent, ToolApproval } from "@agboss/core";
import { hours } from "@agboss/core/units";

/** The operator's sign-off before a high-risk chunk is committed: the thread's owner answers it. */
@ToolApproval({
  name: "chunk-sign-off-tool-approval",
  description: "Operator approval required before committing a high-risk chunk",
  respondent: PauseRespondent.Owner,
  timeout: hours(24),
})
export class ChunkSignOffToolApproval {}
