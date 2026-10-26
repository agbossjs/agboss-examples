import { Agent, listOf } from "@agboss/core";
import { ReplyDraftDto } from "../../dto/reply-draft.dto.js";
import { ResearchFindingDto } from "../../dto/research-finding.dto.js";
import { SupportRequestDto } from "../../dto/support-request.dto.js";

@Agent({
  name: "reply-writer-agent",
  description: "Writes the first reply from the findings",
  promptUrls: ["./reply-writer.prompt.md"],
  model: "openai/gpt-4o-mini",
  input: { request: SupportRequestDto, findings: listOf(ResearchFindingDto) },
  output: ReplyDraftDto,
})
export class ReplyWriterAgent {}
