/**
 * `npm run demo` (offline: a scripted OpenRouter, no key) and `npm run demo:live` (OpenRouter, a few
 * cents; `OPENROUTER_API_KEY` in the environment or `.env`). Everything printed is read from the
 * executions' own state — `result.launches`, `result.pending`, `result.toolCalls`, the pause store —
 * never from a log; the demo checks what it prints and exits non-zero when a promise does not hold.
 */
import {
  createApp,
  ExecutionStatus,
  PausedExecutionRepository,
  PauseKind,
  PauseStatus,
  ToolCallStatus,
  UninterpretableReplyError,
  type App,
  type ExecutionOutput,
} from "@agboss/core";
import {
  installOfflineNetworkGuard,
  isLiveDemoRequested,
  requireLiveApiKey,
} from "../../scripts/tooling/offline-transports.js";
import { createOfflineOpenRouter, withUncitedCompliance } from "../fixtures/offline-openrouter.js";
import type { PurchaseRequestDto } from "./dto/purchase-request.dto.js";
import { ApproverInbox } from "./services/approver-inbox.service.js";
import { BudgetOwnerInbox } from "./services/budget-owner-inbox.service.js";
import { SupplierPurchaseApplication } from "./supplier-purchase.application.js";
import { BudgetRaiseRequestWorkflowStart } from "./workflows/budget-raise/budget-raise-request.workflow-start.js";
import { PurchaseRequestWorkflowStart } from "./workflows/supplier-purchase/purchase-request.workflow-start.js";

const LAPTOPS: PurchaseRequestDto = {
  supplier: "Northwind Hardware",
  itemDescription: "12 developer laptops",
  amountUsd: 1_200,
  contractTerms: "Liability capped at the order value (§7.2); 30-day termination (§9.1); no customer data shared.",
  supplierProfile: "Vetted in 2025 under PP-4.1 vendor vetting; no sanctions hits; based in the EU.",
  marketQuotes: "Three quotes for the same 12 laptops, 2026-10: $1,240, $1,250 and $1,260.",
  budgetLine: "OPEX-IT-2026, $10,000 left before this purchase.",
};
const APPROVER = { answeredBy: "approver-dana" };

function check(condition: boolean, what: string): void {
  if (!condition) throw new Error(`demo check failed: ${what}`);
}

const usd = (amount: number): string => `$${amount.toFixed(6)}`;

/** One row per branch of the launch: the agent, its status and verdict, who rejected it. */
function printVerdicts(result: ExecutionOutput): void {
  const [launch] = result.launches;
  console.table(
    (launch?.branches ?? []).map((branch) => ({
      agent: branch.nodeId,
      status: branch.status,
      verdict: branch.verdict ?? "—",
      "rejected by": branch.rejectedBy?.join(", ") ?? "",
      "counted as": branch.acceptedSequence ?? "",
    })),
  );
  const group = launch?.group;
  console.log(
    `   winning group: ${group === undefined ? "none" : `${group.agents.join(" + ")} (priority ${String(group.priority)})`}`,
  );
}

/** The newest approval request the inbox holds: its pause id is the channel's, never the caller's. */
function postedPauseId(app: App): string {
  const posted = app.resolve(ApproverInbox).latest();
  if (posted === undefined) throw new Error("demo check failed: the approver was never asked");
  return posted.pauseId;
}

async function pauseStatusOf(app: App, pauseId: string): Promise<PauseStatus | undefined> {
  const stored = await app.resolve(PausedExecutionRepository).findByTenantIdAndPauseId("default", pauseId);
  return stored?.status;
}

async function main(): Promise<void> {
  const isLive = isLiveDemoRequested();
  const apiKey = isLive ? requireLiveApiKey() : "offline-demo-openrouter-api-key";
  const restoreFetch = isLive ? (): void => undefined : installOfflineNetworkGuard();
  const processEnv = { ...process.env, OPENROUTER_API_KEY: apiKey };
  const app = await createApp(SupplierPurchaseApplication, {
    processEnv,
    ...(isLive ? {} : { providerFetch: createOfflineOpenRouter().fetch }),
  });
  // the failure injection: a compliance reviewer that cites no clause (scripted even when live)
  const disagreeingApp = await createApp(SupplierPurchaseApplication, {
    processEnv,
    providerFetch: isLive
      ? withUncitedCompliance(fetch)
      : createOfflineOpenRouter({ uncitedCompliance: true }).fetch,
  });
  console.log(
    `supplier purchase demo — ${isLive ? "live (OpenRouter)" : "offline: no network, no key — the scripted OpenRouter reports nominal costs"}\n`,
  );

  try {
    console.log("1. Four reviews in two quorum groups; the approval comes as free text");
    const paused = await app.execute(PurchaseRequestWorkflowStart, LAPTOPS);
    printVerdicts(paused);
    check(paused.launches[0]?.group?.priority === 1, "group 1 did not win");
    check(paused.status === ExecutionStatus.Paused, `the order did not wait for its approver: ${paused.status}`);
    const reply = "ok but only up to $500";
    console.log(`   approver replies: "${reply}"`);
    const done = await app.resume({ pauseId: postedPauseId(app), reply }, APPROVER);
    const [placed] = done.toolCalls;
    console.log(`   the tool ran with: ${JSON.stringify(placed?.input)}`);
    console.log(`   finish: ${done.finish?.name ?? done.status} ${JSON.stringify(done.output)}`);
    console.log(`   spend: ${usd(done.spend.totalUsd)} in ${String(done.spend.calls)} calls\n`);
    check(done.status === ExecutionStatus.Finished, `the approved run did not finish: ${done.status}`);
    check(placed?.status === ToolCallStatus.Succeeded, `the order did not run: ${String(placed?.status)}`);
    check((placed?.input as { amountUsd?: number } | undefined)?.amountUsd === 500, "the order was not capped at $500");
    check(
      (done.output as { amountUsd?: number } | undefined)?.amountUsd === 500,
      "the order agent reported another amount than the tool placed",
    );

    console.log("2. The groups disagree: the compliance review cites no clause");
    const deferred = await disagreeingApp.execute(PurchaseRequestWorkflowStart, LAPTOPS);
    printVerdicts(deferred);
    console.log(`   finish: ${deferred.finish?.name ?? deferred.status}\n`);
    const compliance = deferred.launches[0]?.branches.find((branch) => branch.nodeId === "compliance-review-agent");
    check(compliance?.rejectedBy?.includes("well-formed-review-arbiter") === true, "the uncited review counted");
    check(deferred.finish?.name === "purchase-deferred-workflow-finish", "group 2 did not go on");

    console.log("3. An unreadable reply, then a readable one");
    await app.execute(PurchaseRequestWorkflowStart, LAPTOPS);
    const pauseId = postedPauseId(app);
    try {
      await app.resume({ pauseId, reply: "🤷" }, APPROVER);
      check(false, "the unreadable reply resumed the run");
    } catch (error) {
      if (!(error instanceof UninterpretableReplyError)) throw error;
      console.log(`   "🤷" → ${error.name} (${UninterpretableReplyError.code}): ${error.reason}`);
    }
    const status = await pauseStatusOf(app, pauseId);
    console.log(`   the pause is still: ${String(status)}`);
    check(status === PauseStatus.Pending, "the pause did not stay pending");
    const second = await app.resume({ pauseId, reply: "yes, up to $900" }, APPROVER);
    console.log(`   "yes, up to $900" → ${second.finish?.name ?? second.status} ${JSON.stringify(second.output)}\n`);
    check(second.status === ExecutionStatus.Finished, "the readable reply did not resume the run");

    console.log("4. A question role: the budget owner is asked a typed question, in free text");
    const raise = { budgetLine: "OPEX-IT-2026", amountUsd: 1_800, requester: "Ana Silva" };
    const askedBefore = app.resolve(BudgetOwnerInbox).posted().count;
    const asked = await app.execute(BudgetRaiseRequestWorkflowStart, raise);
    const [question] = asked.pending;
    check(question?.kind === PauseKind.Question, "the budget raise did not pause on its question");
    console.log(`   paused at ${question?.step ?? "?"} (${question?.kind ?? "?"})`);
    const owner = { answeredBy: "budget-owner-lee" };
    const ownerPauseId = (): string => {
      const { latestPauseId } = app.resolve(BudgetOwnerInbox).posted();
      if (latestPauseId === undefined) throw new Error("demo check failed: the budget owner was never asked");
      return latestPauseId;
    };
    const lower = await app.resume({ pauseId: ownerPauseId(), reply: "up to $500" }, owner);
    console.log(`   "up to $500" is below $1,800 → asked again: ${lower.status}`);
    check(lower.status === ExecutionStatus.Paused, "a limit below the request did not ask again");
    const raised = await app.resume({ pauseId: ownerPauseId(), reply: "fine, up to $2,000" }, owner);
    console.log(`   "fine, up to $2,000" → ${raised.finish?.name ?? raised.status} ${JSON.stringify(raised.output)}\n`);
    check(raised.finish?.name === "budget-raised-workflow-finish", "the owner's limit did not raise the line");
    check(app.resolve(BudgetOwnerInbox).posted().count === askedBefore + 2, "the owner was not asked exactly twice");

    console.log("OK — every check above holds.");
  } finally {
    await app.close();
    await disagreeingApp.close();
    restoreFetch();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
