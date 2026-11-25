import { FilePolicy } from "@agboss/core";
import { hours } from "@agboss/core/units";

/** The screenshots the web agent takes: PNG images, a few per run, kept an hour after the run ends. */
@FilePolicy({
  ttl: hours(1),
  maxFiles: 4,
  allowedMediaTypes: ["image/png"],
})
export class ScreenshotFilePolicy {}
