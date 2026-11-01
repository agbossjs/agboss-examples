import { ApplicationContext, createApp } from "@agboss/core";
import type { CheckoutRequestDto } from "../../src/dto/checkout-request.dto.js";
import { CheckoutWorkflowStart } from "../../src/workflows/checkout/checkout.workflow-start.js";
import { PodApplication } from "./pod.application.js";

/**
 * One pod of the real-process scenarios (PS2, PS5): the application on the shared SQLite file
 * (`SAFE_PAYMENTS_SQLITE_PATH`), told over IPC what to execute. Its recovery sweep runs by itself,
 * on real time — a lease of 30 s, a sweep every 30 s.
 */
const app = await createApp(PodApplication, { env: "offline" });
process.on("message", (message: { readonly execute?: CheckoutRequestDto }) => {
  const order = message.execute;
  if (order === undefined) return;
  app.execute(CheckoutWorkflowStart, order).then(
    () => process.send?.({ ended: "finished" }),
    (error: unknown) => process.send?.({ ended: error instanceof Error ? error.name : "failed" }),
  );
});
process.send?.({ ready: app.resolve(ApplicationContext).instanceId });
