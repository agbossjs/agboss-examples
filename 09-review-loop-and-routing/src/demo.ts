/**
 * `npm run demo` (offline, $0: a scripted OpenRouter) and `npm run demo:live` (OpenRouter, a few
 * cents; `OPENROUTER_API_KEY` in the environment or `.env`). Everything printed is read from the
 * executions' own state — `result.path`, `result.spend`, `result.record` — never from a log; the
 * demo checks what it prints and exits non-zero when a promise does not hold.
 */
import { createApp, ExecutionStatus, type ExecutionOutput } from "@agboss/core";
import {
  installOfflineNetworkGuard,
  isLiveDemoRequested,
  requireLiveApiKey,
} from "../../scripts/tooling/offline-transports.js";
import { createOfflineOpenRouter, withStubbornCritic } from "../fixtures/offline-openrouter.js";
import { CreditReviewApplication } from "./credit-review.application.js";
import type { CreditApplicationDto } from "./dto/credit-application.dto.js";
import { CodeRoutedCreditWorkflowStart } from "./workflows/credit-review/code-routed-credit.workflow-start.js";
import { ModelRoutedCreditWorkflowStart } from "./workflows/credit-review/model-routed-credit.workflow-start.js";

const DANA: CreditApplicationDto = {
  applicantName: "Dana Levi",
  amountUsd: 40_000,
  creditScore: 720,
  debtToIncome: 0.28,
  purpose: "Renovating the kitchen of the flat I own",
};

const APPLICATIONS: readonly CreditApplicationDto[] = [
  DANA,
  {
    applicantName: "Omer Katz",
    amountUsd: 15_000,
    creditScore: 540,
    debtToIncome: 0.3,
    purpose: "Consolidating card debt",
  },
];

const ROUTERS = new Set(["credit-limit-code-router", "credit-intent-model-router"]);

interface RoutingRow {
  readonly applicant: string;
  readonly start: string;
  readonly router: string;
  readonly route: string;
  readonly routerCalls: number;
  readonly routerSpendUsd: number;
  readonly routerWallMs: number;
  readonly reviews: number;
  readonly finish: string;
  readonly totalSpendUsd: number;
}

function check(condition: boolean, what: string): void {
  if (!condition) throw new Error(`demo check failed: ${what}`);
}

const usd = (amount: number): string => `$${amount.toFixed(6)}`;

/** The router's step of a recorded execution: what it chose, what it cost, how long it took. */
function routingRowOf(applicant: string, result: ExecutionOutput): RoutingRow {
  const routerIndex = result.path.findIndex((node) => ROUTERS.has(node));
  const router = result.path[routerIndex] ?? "?";
  const step = result.record?.steps.find((entry) => entry.step.component.name === router);
  return {
    applicant,
    start: result.path[0] ?? "?",
    router,
    route: result.path[routerIndex + 1] ?? "?",
    routerCalls: step?.spend.calls ?? 0,
    routerSpendUsd: step?.spend.totalUsd ?? 0,
    routerWallMs: step === undefined ? 0 : Date.parse(step.endedAt) - Date.parse(step.startedAt),
    reviews: result.path.filter((node) => node === "risk-officer-agent").length,
    finish: result.finish?.name ?? result.status,
    totalSpendUsd: result.spend.totalUsd,
  };
}

function printRouting(rows: readonly RoutingRow[]): void {
  console.log("1. The same applications, routed by code and by a model");
  console.table(
    rows.map((row) => ({
      applicant: row.applicant,
      router: row.router,
      route: row.route,
      "router calls": row.routerCalls,
      "router spend": usd(row.routerSpendUsd),
      "router ms": row.routerWallMs,
      reviews: row.reviews,
      finish: row.finish,
      "run spend": usd(row.totalSpendUsd),
    })),
  );
}

async function main(): Promise<void> {
  const isLive = isLiveDemoRequested();
  const apiKey = isLive ? requireLiveApiKey() : "offline-demo-openrouter-api-key";
  const restoreFetch = isLive ? (): void => undefined : installOfflineNetworkGuard();
  const offline = createOfflineOpenRouter();
  const processEnv = { ...process.env, OPENROUTER_API_KEY: apiKey };
  const app = await createApp(CreditReviewApplication, {
    processEnv,
    ...(isLive ? {} : { providerFetch: offline.fetch }),
  });
  // the failure injection: a risk officer that never approves (scripted even when live)
  const stubbornApp = await createApp(CreditReviewApplication, {
    processEnv,
    providerFetch: isLive
      ? withStubbornCritic(fetch)
      : createOfflineOpenRouter({ stubbornCritic: true }).fetch,
  });
  console.log(
    `credit review demo — ${isLive ? "live (OpenRouter)" : "offline: no network, no key — the scripted OpenRouter reports nominal costs"}\n`,
  );

  try {
    const rows: RoutingRow[] = [];
    for (const application of APPLICATIONS) {
      for (const start of [CodeRoutedCreditWorkflowStart, ModelRoutedCreditWorkflowStart]) {
        const result = await app.execute(start, application, { record: true });
        check(
          result.status === ExecutionStatus.Finished,
          `${application.applicantName}: ${result.status}`,
        );
        rows.push(routingRowOf(application.applicantName, result));
      }
    }
    printRouting(rows);
    for (const application of APPLICATIONS) {
      const [byCode, byModel] = rows.filter((row) => row.applicant === application.applicantName);
      check(
        byCode?.route === byModel?.route,
        `${application.applicantName}: the code router chose ${byCode?.route ?? "?"}, the model router ${byModel?.route ?? "?"}`,
      );
      check(
        byCode?.routerCalls === 0 && byCode.routerSpendUsd === 0,
        "the code router made a model call",
      );
      check((byModel?.routerCalls ?? 0) === 1, "the model router made no decision");
    }
    console.log("   → the same route either way; the code router: 0 calls, $0\n");

    const stubborn = await stubbornApp.execute(CodeRoutedCreditWorkflowStart, DANA, {
      record: true,
    });
    const editorVisits = stubborn.path.filter((node) => node === "memo-editor-agent").length;
    const editorCalls = stubborn.spend.trace.filter(
      (line) => line.caller === "memo-editor-agent",
    ).length;
    const handled = stubborn.handledErrors.map(
      ({ error, at, by }) => `${error.code} at ${at.name} → ${by.name}`,
    );
    console.log(
      `2. A risk officer that never approves${isLive ? " (scripted: the failure injection; the rest is live)" : ""}`,
    );
    console.log(`   path:    ${stubborn.path.join(" → ")}`);
    console.log(`   finish:  ${stubborn.finish?.name ?? stubborn.status}`);
    console.log(
      `   editor:  ${String(editorCalls)} model calls (a 4th visit refused: ${handled.join(", ")})`,
    );
    console.log(
      `   spend:   ${usd(stubborn.spend.totalUsd)} in ${String(stubborn.spend.calls)} calls\n`,
    );
    check(
      stubborn.finish?.name === "credit-escalated-workflow-finish",
      "the stubborn run did not escalate",
    );
    check(editorCalls === 3 && editorVisits === 4, `the editor ran ${String(editorCalls)} times`);

    if (!isLive) {
      check(offline.calls.length > 0, "the offline OpenRouter was never called");
    }
    console.log("OK — every check above holds.");
  } finally {
    await app.close();
    await stubbornApp.close();
    restoreFetch();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
