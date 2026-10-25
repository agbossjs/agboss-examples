import {
  BranchStatus,
  BranchVerdict,
  createApp,
  ExecutionStatus,
} from "agboss";
import { TravelBookingRequestDto } from "../src/dto/travel-booking-request.dto.js";
import { resetOperationLedger } from "../src/services/operation-ledger.service.js";
import { TravelBookingSagaApplication } from "../src/travel-booking-saga.application.js";
import { QuorumSagaWorkflowStart } from "../src/workflows/quorum-saga/quorum-saga.workflow-start.js";

export interface QuorumApprovalScenarioResult {
  readonly status: ExecutionStatus;
  readonly outcomeStatus: string | undefined;
  readonly summary: string | undefined;
  readonly branches: readonly {
    readonly agent: string;
    readonly status: BranchStatus;
    readonly verdict?: BranchVerdict | undefined;
  }[];
}

/**
 * Scenario E — 2-of-3 Parallel Quorum Approval:
 * Launches `FinanceReviewerAgent`, `ComplianceReviewerAgent`, and `RiskReviewerAgent` in parallel
 * with `.acceptedBy(BookingQuorumArbiter).joinQuorum({ min: 2, max: 2 })`.
 * Finance (95) and Compliance (92) pass `BookingQuorumArbiter`, while Risk (45, approved=false) is rejected.
 * The quorum succeeds with 2 counted votes.
 */
export async function runQuorumApprovalScenario(
  bookingId = "QUORUM-E1",
): Promise<QuorumApprovalScenarioResult> {
  resetOperationLedger();
  const app = await createApp(TravelBookingSagaApplication);
  try {
    const result = await app.execute(
      QuorumSagaWorkflowStart,
      Object.assign(new TravelBookingRequestDto(), {
        bookingId,
        travelerId: "trav-05",
        flightCode: "SFO-FRA-505",
        hotelCode: "FRANKFURT-HOF-4",
        totalAmountUsd: 2750,
        simulatePaymentDecline: false,
      }),
    );

    const launch = result.launches[0];
    return {
      status: result.status,
      outcomeStatus: result.output?.status,
      summary: result.output?.summary,
      branches: (launch?.branches ?? []).map((b) => ({
        agent: b.nodeId,
        status: b.status,
        verdict: b.verdict,
      })),
    };
  } finally {
    await app.close();
  }
}
