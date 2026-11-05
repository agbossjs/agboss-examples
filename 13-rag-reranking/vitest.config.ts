import { defineConfig } from "vitest/config";
import { agbossTest } from "@agboss/core/testing/vitest";

// agbossTest() loads AGBoss through vite, in the tests' module graph, and registers the workflow
// matchers (toFollowPath, toFinishWith, toHaveHandledError, …)
export default defineConfig({
  test: agbossTest({
    include: ["tests/**/*.test.ts"],
    // a test that asserts nothing proves nothing
    expect: { requireAssertions: true },
    // tests/demo.test.ts runs the demo in a process
    testTimeout: 120_000,
  }),
});
