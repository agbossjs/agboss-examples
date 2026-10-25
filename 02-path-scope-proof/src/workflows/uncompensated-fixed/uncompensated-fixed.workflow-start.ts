import { WorkflowStart } from "agboss";
import { BookingRequestDto } from "../../dto/booking-request.dto.js";

@WorkflowStart({
  name: "uncompensated-fixed-workflow-start",
  description: "Starts fixed uncompensated-action workflow",
  input: BookingRequestDto,
})
export class UncompensatedFixedStart {}
