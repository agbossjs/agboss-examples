import { defineConfig } from "vitest/config";
import { agbossVitest } from "@agboss/core/testing/vitest";

// agbossVitest() loads AGBoss through vite, in the tests' module graph, and registers the workflow
// matchers (toFollowPath, toFinishWith, …) — no setupFiles entry of our own.
export default defineConfig({
  test: agbossVitest({
    include: ["tests/**/*.test.ts"],
    // synthetic keys for the tests only; the application fails closed without its own
    env: { PII_PSEUDONYM_KEY: "cluster-work-stealing-pseudonym-key-32b!!", IDEMPOTENCY_KEY: "cluster-work-stealing-offline-idempotency-key" },
    testTimeout: 30_000,
  }),
});
