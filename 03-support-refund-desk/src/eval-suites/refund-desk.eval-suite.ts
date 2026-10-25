import {
  EvalCascade,
  EvalSuite,
  checkTrajectory,
  evalCase,
  judgedBy,
  pastTurn,
  toolCall,
  toolInvariant,
  turn,
} from "agboss/eval";
import { CitationCodeJudge } from "../judges/citation-code/citation-code.judge.js";
import { GroundedAnswerJudge } from "../judges/grounded-answer/grounded-answer.judge.js";
import { IssueRefundTool } from "../tools/issue-refund.tool.js";
import { LookupOrderTool } from "../tools/lookup-order.tool.js";
import { SupportRefundWorkflowFinish } from "../workflows/support-refund/support-refund.workflow-finish.js";
import { SupportRefundWorkflowStart } from "../workflows/support-refund/support-refund.workflow-start.js";

/**
 * Why `@EvalSuite` is a first-class declarative component in AGBoss:
 *
 * 1. **Static verification (`agboss check`):** The compiler and static analyzer verify that
 *    `start`, `pastTurn(Start, ..., Finish, ...)`, `toolCall(Tool, ...)`, and `judgedBy(Judge)`
 *    all match the workflow's real DTO contracts before a single model token is spent.
 * 2. **Cost-ordered evaluation cascade (`EvalCascade.StopAtFirstFailure`):**
 *    - `checkTrajectory()` ($0) verifies required/forbidden tool calls and argument invariants first.
 *    - `judgedBy(CitationCodeJudge)` ($0 `DecidedBy.Code`) checks deterministic policy citation and cap rules.
 *    - `judgedBy(GroundedAnswerJudge)` (`DecidedBy.Model`) only runs if the $0 checks pass.
 * 3. **Compact Git baseline vs full local artifacts:**
 *    - `npx agboss eval run --suite refund-desk-eval-suite --runs 2 --save-baseline eval/baseline/main-baseline.json`
 *      writes a compact, git-diff-friendly per-case metrics snapshot (`passAtK`, `passHatK`, `flaky`, `avgSpendUsd`, `verdictSummary`).
 *    - Full execution traces and HTML reports live in git-ignored `.agboss/eval/` for `agboss eval show --html` and `agboss eval ui`.
 */
@EvalSuite({
  name: "refund-desk-eval-suite",
  description:
    "Multi-layered evaluation suite for Support Refund Desk: trajectory invariants ($0), deterministic code judge ($0), and grounded model judge.",
  start: SupportRefundWorkflowStart,
  checks: [
    checkTrajectory(),
    judgedBy(CitationCodeJudge),
    judgedBy(GroundedAnswerJudge),
  ],
  cascade: EvalCascade.StopAtFirstFailure,
  cases: [
    evalCase({
      name: "eligible-refund-within-policy",
      tenant: { tenantId: "acme", maxAutoRefundUsd: 500 },
      execution: { locale: "en" },
      turns: [
        turn({
          customerName: "Alice Synth",
          message:
            "Hi, please refund my order ORD-1001 ($180 keyboard). My email is alice.synth@example.com and ticket is TCK-402910.",
        }),
      ],
      variants: [
        turn({
          customerName: "Alice Synth",
          message:
            "Could you process a refund for order ORD-1001? My address is alice.synth@example.com (ticket TCK-402910).",
        }),
      ],
      tools: {
        required: [
          toolCall(LookupOrderTool, { orderId: "ORD-1001" }),
          toolCall(IssueRefundTool, { orderId: "ORD-1001", amountUsd: 180 }),
        ],
        invariants: [
          toolInvariant(IssueRefundTool, (input) => input.amountUsd <= 500),
        ],
      },
    }),
    evalCase({
      name: "over-cap-refund-escalated",
      tenant: { tenantId: "acme", maxAutoRefundUsd: 500 },
      execution: { locale: "en" },
      turns: [
        turn({
          customerName: "Alice Synth",
          message:
            "Please refund my workstation order ORD-1002 ($1450). My email is alice.synth@example.com.",
        }),
      ],
      variants: [
        turn({
          customerName: "Alice Synth",
          message:
            "I need a refund on ORD-1002 ($1450 workstation), email alice.synth@example.com.",
        }),
      ],
      tools: {
        required: [toolCall(LookupOrderTool, { orderId: "ORD-1002" })],
        forbidden: [IssueRefundTool],
      },
    }),
    evalCase({
      name: "policy-drift-past-30-days-denied",
      tenant: { tenantId: "acme", maxAutoRefundUsd: 500 },
      execution: { locale: "en" },
      history: [
        pastTurn(
          SupportRefundWorkflowStart,
          {
            customerName: "Bob Synth",
            message:
              "I bought ORD-1003 45 days ago (email bob.synth@example.com). Under old v1.0 policy I had 90 days.",
          },
          SupportRefundWorkflowFinish,
          {
            decision: "denied",
            orderId: "ORD-1003",
            refundedUsd: 0,
            explanation: "Noted order ORD-1003 under active 30-day policy [policy].",
          },
        ),
      ],
      turns: [
        turn({
          customerName: "Bob Synth",
          message: "Please refund my order ORD-1003 now (email bob.synth@example.com).",
        }),
      ],
      tools: {
        required: [toolCall(LookupOrderTool, { orderId: "ORD-1003" })],
        forbidden: [IssueRefundTool],
      },
    }),
  ],
})
export class RefundDeskEvalSuite {}
