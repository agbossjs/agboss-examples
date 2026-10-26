import { createApp, ExecutionStatus } from "@agboss/core";
import { installOfflineNetworkGuard } from "../../../scripts/tooling/offline-transports.js";
import {
  LEGACY_STATE_FIELD_NAMES,
  runLegacySupportGraph,
} from "../../before-langgraph/support.graph.js";
import { SupportApplication } from "./support.application.js";
import { SupportWorkflowStart } from "./workflows/support/support.workflow-start.js";

const restoreFetch = installOfflineNetworkGuard();
try {
  const legacyTrace = await runLegacySupportGraph({
    orderId: "ORD-7701",
    customerId: "cust-77",
    customerEmail: "alice@example.com",
    message:
      "My order ORD-7701 arrived four days late! Please refund the $15 shipping fee.",
    requestedRefundCents: 1_500,
  });

  const app = await createApp(SupportApplication);
  let afterResult;
  try {
    afterResult = await app.execute(SupportWorkflowStart, {
      orderId: "ORD-7701",
      customerId: "cust-77",
      customerEmail: "alice@example.com",
      message:
        "My order ORD-7701 arrived four days late! Please refund the $15 shipping fee.",
    });
  } finally {
    await app.close();
  }

  if (afterResult.status !== ExecutionStatus.Finished) {
    throw new Error(`Expected after-agboss migration workflow to finish, got: ${String(afterResult.status)}`);
  }

  console.log(
    JSON.stringify(
      {
        project: "07-langgraph-migration",
        status: "passed",
        beforeLangGraph: {
          godStateFieldsCount: LEGACY_STATE_FIELD_NAMES.length,
          firstWriteSawUndefinedDraft: legacyTrace.firstWritePromptSawUndefinedDraft,
          firstWriteSawUndefinedCritique:
            legacyTrace.readonlyfirstWritePromptSawUndefinedCritique,
          unusedFieldPersistedInState: legacyTrace.unusedFieldPersistedInState,
          visitedNodes: legacyTrace.visitedNodes,
        },
        afterAgboss: {
          status: afterResult.status,
          finish: afterResult.finish?.name,
          output: afterResult.output,
          path: afterResult.path,
        },
      },
      null,
      2,
    ),
  );
} finally {
  restoreFetch();
}
