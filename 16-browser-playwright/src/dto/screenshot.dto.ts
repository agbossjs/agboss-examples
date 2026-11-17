import { A2AFileDto } from "@agboss/core/a2a";
import { Nested, Text } from "@agboss/core/dto";

export class ScreenshotRequestDto {
  @Text({ prompt: "the page's full URL, e.g. https://docs.example.com/pricing", maxLength: 2048 })
  url!: string;
}

/**
 * A file field, not text: the framework hands the model the image as a file part, under the
 * application's PII policies, and keeps only its digest in records, traces and cassettes.
 */
export class ScreenshotResultDto {
  @Nested(A2AFileDto, { prompt: "a PNG screenshot of the page" })
  screenshot!: A2AFileDto;
}
