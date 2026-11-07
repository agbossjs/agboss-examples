import { defineConfig } from "vitest/config";
import { agbossVitest } from "@agboss/core/testing/vitest";

// agbossVitest() loads AGBoss through vite, in the tests' module graph, and registers the workflow
// matchers (toFollowPath, toFinishWith, toHaveHandledError, …)
export default defineConfig({
  test: agbossVitest({
    include: ["tests/**/*.test.ts"],
    // a test that asserts nothing proves nothing
    expect: { requireAssertions: true },
    // tests/demo.test.ts and tests/fixtures/missing-route.test.ts run processes
    testTimeout: 120_000,
  }),
});
