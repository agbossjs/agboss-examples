import { Agent } from "@agboss/core";
import { ChangesRequestedDto } from "../../dto/changes-requested.dto.js";
import { ReplyDraftDto } from "../../dto/reply-draft.dto.js";

@Agent({
  name: "reply-editor-agent",
  description: "Rewrites the reply as asked",
  promptUrls: ["./reply-editor.prompt.md"],
  model: "openai/gpt-4o-mini",
  input: { draft: ReplyDraftDto, changes: ChangesRequestedDto },
  output: ReplyDraftDto,
  maxVisits: 2,
})
export class ReplyEditorAgent {}
