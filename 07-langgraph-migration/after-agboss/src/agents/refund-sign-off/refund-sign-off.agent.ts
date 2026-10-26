import { Agent } from "@agboss/core";
import { RefundIssuedDto } from "../../dto/refund-issued.dto.js";
import { ReplyDraftDto } from "../../dto/reply-draft.dto.js";
import { SupportRequestDto } from "../../dto/support-request.dto.js";
import { IssueSignedOffRefundTool } from "../../tools/issue-signed-off-refund.tool.js";

@Agent({
  name: "refund-sign-off-agent",
  description: "Issues a large refund once it is signed off",
  promptUrls: ["./refund-sign-off.prompt.md"],
  model: "openai/gpt-4o-mini",
  input: { request: SupportRequestDto, draft: ReplyDraftDto },
  output: RefundIssuedDto,
  tools: [IssueSignedOffRefundTool],
  maxToolCalls: 1,
})
export class RefundSignOffAgent {}
