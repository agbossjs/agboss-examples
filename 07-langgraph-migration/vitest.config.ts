import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["after-agboss/tests/**/*.test.ts"],
    setupFiles: ["@agboss/core/testing/setup"],
    testTimeout: 30_000,
  },
});
