import { Agent, RagMode, TokenLimit } from "agboss";
import { UnauthorizedPayoutGuardrail } from "../guardrails/policy-promise.guardrail.js";
import { PromptInjectionGuardrail } from "../guardrails/prompt-injection.guardrail.js";
import { RefundPolicyRag } from "../memory/refund-policy.rag.js";
import { PolicyAwareCompaction } from "../memory/policy-aware.compaction.js";
import { IssueRefundTool } from "../tools/issue-refund.tool.js";
import { LookupOrderTool } from "../tools/lookup-order.tool.js";
import { SupportAnswerDto, SupportRequestDto } from "../workflows/dtos.js";
import { CitationCodeJudge } from "./judges.js";

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
