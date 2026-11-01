import { Agent, oneOf } from "@agboss/core";
import { CreditApplicationDto } from "../../dto/credit-application.dto.js";
import { CreditMemoDto } from "../../dto/credit-memo.dto.js";
import { MemoApprovedDto } from "../../dto/memo-approved.dto.js";
import { MemoChangesRequestedDto } from "../../dto/memo-changes-requested.dto.js";
import { CHAT_MODEL } from "../../model-providers/models.js";

/**
 * The critic of the loop: reviews the newest memo and requests changes or approves it. Reached
 * from the analyst and from the editor, so its `switch` is a path of its own. Its visits are
 * bounded (`maxVisits: 4`: the first memo and three rewrites) — the editor's limit ends the loop
 * first, on a defined finish.
 */
@Agent({
  name: "risk-officer-agent",
  description: "Reviews the credit memo: requests changes or approves it",
  promptUrls: ["./risk-officer.prompt.md"],
  model: CHAT_MODEL,
  input: {
    application: CreditApplicationDto,
    memo: CreditMemoDto,
  },
  output: oneOf(MemoChangesRequestedDto, MemoApprovedDto),
  maxVisits: 4,
})
export class RiskOfficerAgent {}
