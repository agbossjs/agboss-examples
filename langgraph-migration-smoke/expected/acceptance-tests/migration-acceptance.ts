import { SupportRequestDto } from "../../src/support/support.dto.js";

export const MIGRATION_ACCEPTANCE_REQUEST: SupportRequestDto = {
  orderId: "7",
  customerId: "CUST-1",
  customerEmail: "alice.synth@example.com",
  message: "My order came late, refund it please",
};
