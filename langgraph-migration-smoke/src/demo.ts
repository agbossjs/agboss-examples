import { createApp, ExecutionStatus } from "agboss";
import { createServer } from "node:http";
import { measureMigrationBenchmark } from "../harness/measure-results.js";
import { SupportApplication } from "./application.js";
import { SupportWorkflowStart } from "./support/support.nodes.js";

const scorecard = await measureMigrationBenchmark();

let liveExecution: Record<string, unknown> | undefined;
if (process.env.OPEN_ROUTER_KEY || process.argv.includes("--live")) {
  const exportedChunks: Buffer[] = [];
  const langfuseCollector = createServer((req, res) => {
    const body: Buffer[] = [];
    req.on("data", (chunk: Buffer) => body.push(chunk));
    req.on("end", () => {
      exportedChunks.push(Buffer.concat(body));
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
    });
  });
  await new Promise<void>((resolveListen) =>
    langfuseCollector.listen(0, "127.0.0.1", resolveListen),
  );
  const collectorAddress = langfuseCollector.address();
  const collectorPort =
    typeof collectorAddress === "object" && collectorAddress !== null
      ? collectorAddress.port
      : 0;
  const langfuseBaseUrl = `http://127.0.0.1:${String(collectorPort)}`;

  try {
    const app = await createApp(SupportApplication, {
      processEnv: {
        ...process.env,
        OPENROUTER_API_KEY:
          process.env.OPENROUTER_API_KEY ??
          process.env.OPEN_ROUTER_KEY ??
          "offline-test-openrouter-api-key",
        LANGFUSE_PUBLIC_KEY: "pk-lf-migration-smoke",
        LANGFUSE_SECRET_KEY: "sk-lf-migration-smoke",
        LANGFUSE_BASE_URL: langfuseBaseUrl,
        LANGFUSE_PROJECT_ID: "proj-migration",
      },
    });
    let res;
    try {
      res = await app.execute(
        SupportWorkflowStart,
        {
          orderId: "ORD-7701",
          customerId: "cust-77",
          customerEmail: "alice@example.com",
          message:
            "My order ORD-7701 arrived four days late! Please refund the $15 shipping fee.",
        },
        { threadId: "thread-migration-live" },
      );
    } finally {
      await app.close();
    }

    const rawOtelExport = Buffer.concat(exportedChunks).toString("utf8");
    liveExecution = {
      status: res.status,
      finish: res.status === ExecutionStatus.Finished ? res.finish?.name : undefined,
      output: res.status === ExecutionStatus.Finished ? res.output : undefined,
      path: res.path,
      langfuseTracing: {
        traceUrlMatchesSession:
          res.traceUrl ===
          `${langfuseBaseUrl}/project/proj-migration/sessions/thread-migration-live`,
        otelSpansExportedBytes: rawOtelExport.length,
        tracedNodesPresent:
          rawOtelExport.includes("support-triage-router") &&
          rawOtelExport.includes("research-planner-agent") &&
          rawOtelExport.includes("order-researcher-agent") &&
          rawOtelExport.includes("reply-writer-agent"),
      },
    };
  } finally {
    await new Promise<void>((resolveClose) =>
      langfuseCollector.close(() => resolveClose()),
    );
  }
}

console.log(
  JSON.stringify(
    {
      project: "langgraph-migration-smoke",
      status: "passed",
      scorecard,
      ...(liveExecution ? { liveExecution } : {}),
    },
    null,
    2,
  ),
);
