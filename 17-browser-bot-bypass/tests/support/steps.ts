import type { TestApp, ToolClassOf } from "@agboss/core/testing";

/** One tool of the app as the agents get it (validation, timeout, errors as results): what `app.runTool` gives, without its spend. */
export async function invoked<TInput, TOutput>(
  app: TestApp,
  tool: ToolClassOf<TInput, TOutput>,
  input: TInput,
): Promise<{ readonly kind: "ok"; readonly value: TOutput } | { readonly kind: "error"; readonly message: string; readonly cause?: unknown }> {
  return (await app.runTool(tool, input)).output;
}
