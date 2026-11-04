import { Agent, historyOf } from "@agboss/core";
import { CreditApplicationDto } from "../../dto/credit-application.dto.js";
import { CreditMemoDto } from "../../dto/credit-memo.dto.js";
import { MemoChangesRequestedDto } from "../../dto/memo-changes-requested.dto.js";
import { CHAT_MODEL } from "../../model-providers/models.js";

/**
 * Rewrites the memo by the risk officer's notes. What it reads of the loop is bounded:
 * `historyOf(CreditMemoDto, { limit: 2 })` is `{ current, previous }` — the newest memo and at most
 * two earlier ones (the latest, oldest first) — however long the loop runs, so its prompt never grows without
 * bound: on its fourth visit the analyst's memo is no longer in it. Its visits are bounded too
 * (`maxVisits: 4`): a fifth is refused before its model call
 * with `VisitsLimitExceededError`, which the flow takes to the committee.
 */
@Agent({
  name: "memo-editor-agent",
  description: "Rewrites the credit memo by the risk officer's notes",
  promptUrls: ["./memo-editor.prompt.md"],
  model: CHAT_MODEL,
  input: {
    application: CreditApplicationDto,
    memo: historyOf(CreditMemoDto, { limit: 2 }),
    changes: MemoChangesRequestedDto,
  },
  output: CreditMemoDto,
  maxVisits: 4,
})
export class MemoEditorAgent {}
