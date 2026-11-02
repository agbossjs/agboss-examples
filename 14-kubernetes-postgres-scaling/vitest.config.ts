import { defineConfig } from "vitest/config";
import { agbossTest } from "@agboss/core/testing/vitest";

// agbossTest() loads AGBoss through vite, in the tests' module graph, and registers the workflow
// matchers (toFollowPath, toFinishWith, …)
export default defineConfig({
  test: agbossTest({
    include: ["tests/**/*.test.ts"],
    // a test that asserts nothing proves nothing
    expect: { requireAssertions: true },
    // nothing here calls a model; the built-in provider still wants a key to be built (synthetic)
    env: { SCALING_UNUSED_MODEL_KEY: "offline-no-model-is-ever-called" },
  }),
});
