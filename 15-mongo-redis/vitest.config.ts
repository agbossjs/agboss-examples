import { defineConfig } from "vitest/config";
import { agbossVitest } from "@agboss/core/testing/vitest";

// agbossVitest() loads AGBoss through vite, in the tests' module graph, and registers the workflow
// matchers (toFollowPath, toFinishWith, …)
export default defineConfig({
  test: agbossVitest({
    include: ["tests/**/*.test.ts"],
    // a test that asserts nothing proves nothing
    expect: { requireAssertions: true },
    // synthetic key for the tests only (R6); the rows in memory unless a test gives two instances a file
    env: { SQLITE_PATH: ":memory:", PII_PSEUDONYM_KEY: "mongo-redis-offline-pseudonym-key" },
  }),
});
