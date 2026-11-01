import { defineConfig } from "vitest/config";
import { agbossTest } from "@agboss/core/testing/vitest";

// agbossTest() loads AGBoss through vite, in the tests' module graph, and registers the workflow
// matchers (toFollowPath, toFinishWith, …) — no setupFiles entry of our own.
export default defineConfig({
  test: agbossTest({
    include: ["tests/**/*.test.ts"],
    testTimeout: 120_000,
  }),
});
