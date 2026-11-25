import { FilePolicy } from "@agboss/core";
import { hours, kilobytes } from "@agboss/core/units";

/**
 * What the invoice review takes as files: one CSV of at most 8 KB (a bigger file, another media type or a
 * second file is refused at the door), kept an hour after the task is over.
 */
@FilePolicy({
  ttl: hours(1),
  maxFiles: 1,
  maxFileSize: kilobytes(8),
  maxTotalFileSize: kilobytes(8),
  allowedMediaTypes: ["text/csv"],
})
export class InvoiceReviewFilePolicy {}
