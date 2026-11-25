import { ExecutionContext, Files, Tool, type ToolHandler } from "@agboss/core";
import { seconds } from "@agboss/core/units";
import { OriginRefusedError, isAllowedUrl } from "../browser/origin-allowlist.js";
import { SharedBrowser } from "../browser/shared-browser.service.js";
import { ScreenshotRequestDto, ScreenshotResultDto } from "../dto/screenshot.dto.js";

const NAVIGATION_TIMEOUT_MS = 10_000;

/**
 * Way A: a screenshot of a page, returned as a file. The agent opts in to tool-result files
 * (`files: ModelFiles.of({ sources: [FileSource.ToolResults] })`), so its model receives the PNG as
 * an image part — not as base64 text — and the application's PII policies decide what of it the
 * model may see. The bytes live in the application's file store (`Files`); the step and its records hold a
 * descriptor.
 */
@Tool({
  name: "screenshot-tool",
  description: "Take a PNG screenshot of a web page. Only the allowed sites can be opened.",
  input: ScreenshotRequestDto,
  output: ScreenshotResultDto,
  timeout: seconds(20),
  readOnly: true,
  deps: [ExecutionContext, SharedBrowser, Files],
})
export class Screenshot implements ToolHandler<ScreenshotRequestDto, ScreenshotResultDto> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly sharedBrowser: SharedBrowser,
    private readonly files: Files,
  ) {}

  async execute({ url }: ScreenshotRequestDto): Promise<ScreenshotResultDto> {
    if (!isAllowedUrl(url, this.sharedBrowser.allowedOrigins)) throw new OriginRefusedError(url);
    const png = await this.sharedBrowser.handle.use(this.executionContext.signal, async (context) => {
      const page = await context.newPage();
      await page.goto(url, { timeout: NAVIGATION_TIMEOUT_MS, waitUntil: "load" });
      return page.screenshot({ type: "png" });
    });
    return { screenshot: await this.files.save({ bytes: png, mediaType: "image/png", filename: "page.png" }) };
  }
}
