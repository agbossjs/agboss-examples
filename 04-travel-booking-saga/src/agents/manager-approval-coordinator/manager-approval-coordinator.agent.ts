import { Agent } from "@agboss/core";
import { FlightReservationDto } from "../../dto/flight-reservation.dto.js";
import { HighValueHoldOutputDto } from "../../dto/high-value-hold-output.dto.js";
import { HotelReservationDto } from "../../dto/hotel-reservation.dto.js";
import { TravelBookingRequestDto } from "../../dto/travel-booking-request.dto.js";
import { RequestManagerApprovalTool } from "../../tools/request-manager-approval.tool.js";

@Agent({
  name: "manager-approval-coordinator-agent",
  description: "Coordinates human-in-the-loop manager approval via RequestManagerApprovalTool",
  model: "saga-model",
  promptUrls: ["./manager-approval-coordinator.prompt.md"],
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
  },
  output: HighValueHoldOutputDto,
  tools: [RequestManagerApprovalTool],
  maxTokens: 512,
})
export class ManagerApprovalCoordinatorAgent {}
