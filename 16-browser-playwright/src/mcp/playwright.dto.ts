import { Decimal, Text } from "@agboss/core/dto";

/** `browser_navigate` of @playwright/mcp: where to go. */
export class NavigateArgumentsDto {
  @Text({ prompt: "the URL to open" })
  url!: string;
}

/** `browser_snapshot`: the current page's accessibility snapshot, optionally to a depth. */
export class SnapshotArgumentsDto {
  @Decimal({ prompt: "how deep to snapshot the page; all when left out", optional: true, min: 1 })
  depth?: number;
}

/** `browser_evaluate`: a JavaScript function to run in the page. */
export class EvaluateArgumentsDto {
  @Text({ prompt: "a JavaScript arrow function, e.g. () => document.title" })
  function!: string;
}

/** What the server answers: its text (the page, the result, the code it ran). */
export class ServerTextDto {
  @Text({ prompt: "the server's text answer" })
  text!: string;
}
