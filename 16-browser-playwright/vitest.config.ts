import { defineConfig } from "vitest/config";
import { agbossVitest } from "@agboss/core/testing/vitest";

// agbossVitest() loads AGBoss through vite, in the tests' module graph, and registers the workflow
// matchers (toFollowPath, toFinishWith, toHaveHandledError, …)
export default defineConfig({
  test: agbossVitest({
    include: ["tests/**/*.test.ts"],
    // synthetic keys for the tests only; the application fails closed without its own
    env: {
      PII_PSEUDONYM_KEY: "browser-playwright-offline-pseudonym-key",
      IDEMPOTENCY_KEY: "browser-playwright-offline-idempotency-key",
    },
    // a test that asserts nothing proves nothing
    expect: { requireAssertions: true },
    // tests/demo.test.ts runs the demo in a process; a real Chromium starts in the first test
    testTimeout: 120_000,
  }),
});
