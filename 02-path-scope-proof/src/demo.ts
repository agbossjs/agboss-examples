import { createApp, ExecutionStatus } from "agboss";
import { installOfflineNetworkGuard } from "../../scripts/tooling/offline-transports.js";
import {
  CheckoutRequestDto,
  MissingInputFixedApplication,
  MissingInputFixedStart,
} from "../cases/01-missing-input/agboss-fixed/application.js";
import { buildBrokenMissingInputLangGraph } from "../cases/01-missing-input/langgraph-broken/graph.js";
import {
  OrderDraftDto,
  OutdatedDataFixedApplication,
  OutdatedDataFixedStart,
} from "../cases/02-outdated-data/agboss-fixed/application.js";
import { buildBrokenOutdatedDataLangGraph } from "../cases/02-outdated-data/langgraph-broken/graph.js";
import {
  CartRequestDto,
  ParallelInvalidationFixedApplication,
  ParallelInvalidationFixedStart,
} from "../cases/03-parallel-invalidation/agboss-fixed/application.js";
import { buildBrokenParallelInvalidationLangGraph } from "../cases/03-parallel-invalidation/langgraph-broken/graph.js";
import {
  BookingRequestDto,
  UncompensatedFixedApplication,
  UncompensatedFixedStart,
} from "../cases/04-uncompensated-action/agboss-fixed/application.js";

async function main(): Promise<void> {
  const restoreFetch = installOfflineNetworkGuard();
  try {
    // Case 01: Missing Input
    const lgGraph01 = buildBrokenMissingInputLangGraph();
    let lg01Error = "";
    try {
      await lgGraph01.invoke({
        draft: {
          contractId: "C-01",
          summary: "Fast-track NDA",
          fastTrackRequested: true,
        },
        approval: undefined,
        publishedRecord: undefined,
      });
    } catch (err) {
      lg01Error = err instanceof Error ? err.message : String(err);
    }

    const app01 = await createApp(MissingInputFixedApplication);
    const run01 = await app01.execute(
      MissingInputFixedStart,
      Object.assign(new CheckoutRequestDto(), {
        orderId: "ORD-01",
        tier: "standard",
        subtotalCents: 10_000,
      }),
    );
    await app01.close();

    // Case 02: Outdated Data
    const lgGraph02 = buildBrokenOutdatedDataLangGraph();
    const lg02 = await lgGraph02.invoke({
      topic: "Enterprise MSA",
      draft: undefined,
      legalSignoff: undefined,
      needsRevision: undefined,
      finalizedContract: undefined,
    });

    const app02 = await createApp(OutdatedDataFixedApplication);
    const run02 = await app02.execute(
      OutdatedDataFixedStart,
      Object.assign(new OrderDraftDto(), {
        orderId: "ORD-02",
        subtotalCents: 10_000,
        destinationCountry: "US",
        requestedCountryChange: "DE",
      }),
    );
    await app02.close();

    // Case 03: Parallel Invalidation
    const lgGraph03 = buildBrokenParallelInvalidationLangGraph();
    const lg03 = await lgGraph03.invoke({
      quoteId: "Q-03",
      quoteSheet: undefined,
      taxAuditReport: undefined,
      invoiceSummary: undefined,
    });

    const app03 = await createApp(ParallelInvalidationFixedApplication);
    const run03 = await app03.execute(
      ParallelInvalidationFixedStart,
      Object.assign(new CartRequestDto(), {
        cartId: "CART-03",
        baseCents: 10_000,
      }),
    );
    await app03.close();

    // Case 04: Uncompensated Action
    const app04 = await createApp(UncompensatedFixedApplication);
    const run04 = await app04.execute(
      UncompensatedFixedStart,
      Object.assign(new BookingRequestDto(), {
        bookingId: "BK-04",
        amountCents: 75_000,
      }),
    );
    await app04.close();

    if (
      !lg01Error ||
      run01.status !== ExecutionStatus.Finished ||
      run02.status !== ExecutionStatus.Finished ||
      run03.status !== ExecutionStatus.Finished ||
      run04.status !== ExecutionStatus.Finished
    ) {
      throw new Error("Expected all 4 fixed Path Scope cases to finish cleanly.");
    }

    console.log(
      JSON.stringify(
        {
          case01MissingInput: {
            langgraphRuntimeCrash: lg01Error,
            agbossFixedOutput: run01.output,
          },
          case02OutdatedData: {
            langgraphStaleFailure: lg02.finalizedContract,
            agbossFixedOutput: run02.output,
          },
          case03ParallelInvalidation: {
            langgraphInconsistentInvoice: lg03.invoiceSummary,
            agbossFixedOutput: run03.output,
          },
          case04UncompensatedAction: {
            agbossFixedCompensatedOutput: run04.output,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    restoreFetch();
  }
}

await main();
