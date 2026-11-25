import { testUnit } from "@agboss/core/testing";
import { usd } from "@agboss/core/units";
import { describe, expect, it } from "vitest";
import { CancelFlightCompensationAction } from "../../src/actions/cancel-flight-compensation.action.js";
import { CancelHotelCompensationAction } from "../../src/actions/cancel-hotel-compensation.action.js";
import { CapturePaymentAction } from "../../src/actions/capture-payment.action.js";
import { ReserveFlightAction } from "../../src/actions/reserve-flight.action.js";
import { ReserveHotelAction } from "../../src/actions/reserve-hotel.action.js";
import { ComplianceReviewerAgent } from "../../src/agents/compliance-reviewer/compliance-reviewer.agent.js";
import { FinanceReviewerAgent } from "../../src/agents/finance-reviewer/finance-reviewer.agent.js";
import { RiskReviewerAgent } from "../../src/agents/risk-reviewer/risk-reviewer.agent.js";
import { BookingQuorumArbiter } from "../../src/arbiters/booking-quorum/booking-quorum.arbiter.js";
import { SagaApplicationDailyBudget } from "../../src/budgets/saga-application-daily.budget.js";
import { SagaExecutionBudget } from "../../src/budgets/saga-execution.budget.js";
import { SagaTenantDailyBudget } from "../../src/budgets/saga-tenant-daily.budget.js";
import { getResourceState, resetOperationLedger } from "../../src/services/operation-ledger.service.js";
import { RequestManagerApprovalTool } from "../../src/tools/request-manager-approval.tool.js";


describe("04-travel-booking-saga — Isolated Component Unit Tests", () => {
  describe("BookingQuorumArbiter (@Arbiter unit runner)", () => {
    const runArbiter = testUnit(BookingQuorumArbiter);

    it("counts department votes with approved=true and confidenceScore >= 80, rejecting low-confidence or unapproved votes", async () => {
      const finAccepted = await runArbiter(FinanceReviewerAgent, {
        department: "finance",
        approved: true,
        confidenceScore: 95,
        rationale: "Within Q4 budget",
      });
      expect(finAccepted.output).toBe(true);

      const compAccepted = await runArbiter(ComplianceReviewerAgent, {
        department: "compliance",
        approved: true,
        confidenceScore: 80,
        rationale: "Policy compliant",
      });
      expect(compAccepted.output).toBe(true);

      const riskLowConfidence = await runArbiter(RiskReviewerAgent, {
        department: "risk",
        approved: true,
        confidenceScore: 79,
        rationale: "Uncertain risk profile",
      });
      expect(riskLowConfidence.output).toBe(false);

      const riskRejected = await runArbiter(RiskReviewerAgent, {
        department: "risk",
        approved: false,
        confidenceScore: 99,
        rationale: "High risk region",
      });
      expect(riskRejected.output).toBe(false);
    });
  });

  describe("Forward & Compensation Saga Actions (@Action unit runner)", () => {
    it("reserves and compensates flight and hotel reservations idempotently and captures payment", async () => {
      resetOperationLedger();
      const bookingRequest = {
        bookingId: "UNIT-BK-01",
        travelerId: "trav-unit",
        flightCode: "SFO-JFK-100",
        hotelCode: "NYC-PLAZA-1",
        totalAmountUsd: 1_200,
        simulatePaymentDecline: false,
      };

      const runReserveFlight = testUnit(ReserveFlightAction);
      const { output: flight } = await runReserveFlight({
        request: bookingRequest,
      });
      expect(flight.flightReservationId).toBe("FLIGHT-UNIT-BK-01");
      expect(getResourceState("airline", "FLIGHT-UNIT-BK-01")).toBe("RESERVED");

      const runReserveHotel = testUnit(ReserveHotelAction);
      const { output: hotel } = await runReserveHotel({
        request: bookingRequest,
        flight: flight,
      });
      expect(hotel.hotelReservationId).toBe("HOTEL-UNIT-BK-01");
      expect(getResourceState("hotel", "HOTEL-UNIT-BK-01")).toBe("RESERVED");

      const runCapturePayment = testUnit(CapturePaymentAction);
      const { output: payment } = await runCapturePayment({
        request: bookingRequest,
        flight: flight,
        hotel: hotel,
      });
      expect(payment.paymentTransactionId).toBe("PAY-UNIT-BK-01");
      expect(getResourceState("payments", "PAY-UNIT-BK-01")).toBe("AUTHORIZED");

      const runCancelHotel = testUnit(CancelHotelCompensationAction);
      await runCancelHotel({
        request: bookingRequest,
        hotel: hotel,
      });
      expect(getResourceState("hotel", "HOTEL-UNIT-BK-01")).toBe("RELEASED");

      const runCancelFlight = testUnit(CancelFlightCompensationAction);
      await runCancelFlight({
        request: bookingRequest,
        flight: flight,
      });
      expect(getResourceState("airline", "FLIGHT-UNIT-BK-01")).toBe("RELEASED");
    });
  });

  describe("RequestManagerApprovalTool (@Tool) & Budgets (@Budget)", () => {
    it("executes RequestManagerApprovalTool and verifies @Budget limits", async () => {
      const runApprovalTool = testUnit(RequestManagerApprovalTool);
      const { output } = await runApprovalTool({
        bookingId: "UNIT-HOLD-01",
        amountUsd: 4_500,
      });
      expect(output).toEqual({
        approvalToken: "APPROVED-UNIT-HOLD-01-4500",
        approved: true,
      });

      expect(new SagaApplicationDailyBudget().maxSpend()).toBe(usd(50));
      expect(new SagaTenantDailyBudget().maxSpend()).toBe(usd(20));
      expect(new SagaExecutionBudget().maxSpend()).toBe(usd(0.5));
    });
  });
});
