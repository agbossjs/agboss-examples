# Migration Task: LangGraph `SupportState` → AGBoss Application

You are migrating the legacy LangGraph support application in `source/legacy-langgraph/support.graph.ts` to AGBoss in `src/`.

## Instructions

1. Read `.agents/skills/agboss/SKILL.md` and `.agents/skills/agboss/references/13-migrating-from-langgraph.md` first.
2. Build the **Read / Write Matrix** for all 15 fields of `LegacySupportState` (`orderId`, `customerId`, `customerEmail`, `message`, `category`, `questions`, `question`, `findings`, `draft`, `refundCents`, `critique`, `approved`, `revisions`, `refundId`, `unusedDebugNote`):
   - Slice the 15-field God State into narrow DTO classes (`SupportRequestDto`, `ResearchQuestionDto`, `ResearchFindingDto`, `ReplyDraftDto`, `ChangesRequestedDto`, `ReplyApprovedDto`, `RefundOrderDto`, `RefundIssuedDto`, `OrderLookupDto`, `OrderFactsDto`).
   - Drop unused fields (`unusedDebugNote`) and routing-only flags (`category`, `approved`).
   - Split the legacy `write` node into `ReplyWriterAgent` (first draft) and `ReplyEditorAgent` (revisions) so no node ever reads `draft` or `critique` before they exist (`[input.missing-on-path]`).
   - Annotate the review loop with `caseOf(ChangesRequestedDto, { about: ReplyDraftDto })` and `historyOf(ReplyDraftDto, { limit: 2 })` (`[input.outdated-on-path]`, `[io.ambiguous-cycle]`).
   - Replace `Send("research", ...)` and the array reducer with `.toParallelAgents(OrderResearcherAgent, { maxConcurrency: 3, maxItems: 5 }).join().returns(listOf(ResearchFindingDto))`.
   - Replace `revisions >= 3` with `maxVisits: 2` on `ReplyEditorAgent` and `.onError(VisitsLimitExceededError, toFinish(ReplyStuckWorkflowFinish))`.
   - Replace `interrupt()` in `signOff` with `RefundSignOffChannel` (`@ChannelRole`) and `IssueSignedOffRefundTool` (`@Tool({ channel: RefundSignOffChannel })`).
3. Run `npx agboss check` and `npm test` until all static checks, types, lint rules, and acceptance tests pass with zero errors.
