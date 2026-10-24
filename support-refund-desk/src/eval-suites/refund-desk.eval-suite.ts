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
import { CitationCodeJudge, GroundedAnswerJudge } from "../agents/judges.js";
import { IssueRefundTool } from "../tools/issue-refund.tool.js";
import { LookupOrderTool } from "../tools/lookup-order.tool.js";
import {
  SupportRefundWorkflowFinish,
  SupportRefundWorkflowStart,
} from "../workflows/support-refund.workflow.js";

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
