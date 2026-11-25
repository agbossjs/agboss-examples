import { defineConfig } from "vitest/config";
import { agbossVitest } from "@agboss/core/testing/vitest";
import { OFFLINE_KEYS } from "./apps/1-order-gateway/src/scripts/offline-keys.js";

// agbossVitest() loads AGBoss through vite, in the tests' module graph, and registers the workflow
// matchers (toFollowPath, toFinishWith, …) — no setupFiles entry of our own.
export default defineConfig({
  test: agbossVitest({
    include: ["tests/**/*.test.ts"],
    // synthetic keys for the tests only (R6); the applications fail closed without their own
    env: { ...OFFLINE_KEYS },
    testTimeout: 30_000,
  }),
});
