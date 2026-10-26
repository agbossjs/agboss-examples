import {
  IncompatibleResumeError,
  PausedExecutionRepository,
  type App,
} from "@agboss/core";
import { setAllowIncompatibleResume } from "../src/workflows/chunk-worker/chunk-worker.workflow.js";

export async function simulateVersionDriftOnPausedThread(
  app: Pick<App, "resolve">,
  threadId: string,
  driftedVersion = "0.9.0",
): Promise<void> {
  const pauses = app.resolve(PausedExecutionRepository);
  const existing = await pauses.findByTenantIdAndThreadId("default", threadId);
  if (existing === undefined) {
    throw new Error(`Expected paused execution on thread ${threadId}`);
  }
  await pauses.save({
    ...existing,
    workflowVersion: driftedVersion,
    configHash:
      "0000000000000000000000000000000000000000000000000000000000000000",
  });
}

export { IncompatibleResumeError, setAllowIncompatibleResume };
