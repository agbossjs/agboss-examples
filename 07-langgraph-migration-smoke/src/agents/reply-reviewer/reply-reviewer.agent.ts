import { Agent, historyOf, listOf, oneOf } from "agboss";
import { ChangesRequestedDto } from "../../dto/changes-requested.dto.js";
import { ReplyApprovedDto } from "../../dto/reply-approved.dto.js";
import { ReplyDraftDto } from "../../dto/reply-draft.dto.js";
import { ResearchFindingDto } from "../../dto/research-finding.dto.js";

@Agent({
  name: "reply-reviewer-agent",
  description: "Approves the reply or asks for changes",
  promptUrls: ["./reply-reviewer.prompt.md"],
  model: "openai/gpt-4o-mini",
  input: { draft: historyOf(ReplyDraftDto, { limit: 2 }), findings: listOf(ResearchFindingDto) },
  output: oneOf(ChangesRequestedDto, ReplyApprovedDto),
  maxVisits: 3,
})
export class ReplyReviewerAgent {}
