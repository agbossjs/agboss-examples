import { FilePolicy } from "@agboss/core";
import { hours } from "@agboss/core/units";

/**
 * The receipt photos the desk reads: images, one at a time, kept an hour after the check ends (a redacted
 * copy rides in the execution's state, so no file store is needed).
 */
@FilePolicy({
  ttl: hours(1),
  maxFiles: 1,
  allowedMediaTypes: ["image/png", "image/jpeg"],
})
export class ReceiptFilePolicy {}
