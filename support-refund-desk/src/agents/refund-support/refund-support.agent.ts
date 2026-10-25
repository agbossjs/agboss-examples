import { Agent, RagMode, TokenLimit } from "agboss";
import { PolicyAwareCompaction } from "../../compactions/policy-aware/policy-aware.compaction.js";
import { SupportAnswerDto } from "../../dto/support-answer.dto.js";
import { SupportRequestDto } from "../../dto/support-request.dto.js";
import { UnauthorizedPayoutGuardrail } from "../../guardrails/policy-promise/policy-promise.guardrail.js";
import { PromptInjectionGuardrail } from "../../guardrails/prompt-injection/prompt-injection.guardrail.js";
import { CitationCodeJudge } from "../../judges/citation-code/citation-code.judge.js";
import { RefundPolicyRag } from "../../rag/refund-policy.rag.js";
import { IssueRefundTool } from "../../tools/issue-refund.tool.js";
import { LookupOrderTool } from "../../tools/lookup-order.tool.js";

@Agent({
  name: "refund-support-agent",
  description: "Handles customer refund requests under PII masking, tool interception, guardrails, and policy RAG.",
  promptUrls: ["./refund-support.prompt.md"],
  model: "offline/support-chat",
  input: { request: SupportRequestDto },
  output: SupportAnswerDto,
  tools: [LookupOrderTool, IssueRefundTool],
  maxToolCalls: 5,
  maxTokens: TokenLimit.MODEL_MAX,
  rag: [{ use: RefundPolicyRag, mode: RagMode.Context }],
  judges: [CitationCodeJudge],
  maxRetries: 1,
  uncompactedTurns: 2,
  compaction: PolicyAwareCompaction,
  guardrails: [PromptInjectionGuardrail, UnauthorizedPayoutGuardrail],
})
export class RefundSupportAgent {}
