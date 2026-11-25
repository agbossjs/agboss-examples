import { PauseRespondent, ToolApproval } from "@agboss/core";
import { hours } from "@agboss/core/units";

/** The corporate travel manager's approval of a high-value hold: asked when the agent calls the tool, never answered by the thread's owner. */
@ToolApproval({
  name: "booking-approval-tool-approval",
  description: "Corporate travel manager approval for high-value bookings",
  respondent: PauseRespondent.Delegate,
  // the manager has half a working day; an operator can move this deadline (`app.extendPause`)
  timeout: hours(4),
})
export class BookingApprovalToolApproval {}
