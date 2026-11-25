import { Agent, TokenLimit } from "@agboss/core";
import { PolicyAwareMemory } from "../../memories/policy-aware/policy-aware.memory.js";
import { SupportAnswerDto } from "../../dto/support-answer.dto.js";
import { SupportRequestDto } from "../../dto/support-request.dto.js";
import { UnauthorizedPayoutGuardrail } from "../../guardrails/policy-promise/policy-promise.guardrail.js";
import { PromptInjectionGuardrail } from "../../guardrails/prompt-injection/prompt-injection.guardrail.js";
import { CitationCodeJudge } from "../../judges/citation-code/citation-code.judge.js";
import { RefundPolicyRag } from "../../rag/refund-policy.rag.js";
import { IssueRefundTool } from "../../tools/issue-refund.tool.js";
import { LookupOrderTool } from "../../tools/lookup-order.tool.js";

@Agent({
  name: "live-refund-support-agent",
  description: "Live OpenRouter (openai/gpt-4o-mini) refund support agent under PII masking, tool interception, guardrails, and policy RAG.",
  prompt: "./live-refund-support.prompt.md",
  model: "openai/gpt-4o-mini",
  input: { request: SupportRequestDto },
  output: SupportAnswerDto,
  tools: [LookupOrderTool, IssueRefundTool],
  maxTokens: TokenLimit.ModelMax,
  rag: [RefundPolicyRag],
  judges: [CitationCodeJudge],
  memory: PolicyAwareMemory,
  guardrails: [PromptInjectionGuardrail, UnauthorizedPayoutGuardrail],
  executionLimits: { maxToolCalls: 5, maxRetries: 1 },
})
export class LiveRefundSupportAgent {}
