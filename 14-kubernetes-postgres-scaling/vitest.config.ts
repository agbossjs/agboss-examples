import { defineConfig } from "vitest/config";
import { agbossTest } from "@agboss/core/testing/vitest";

// agbossTest() loads AGBoss through vite, in the tests' module graph, and registers the workflow
// matchers (toFollowPath, toFinishWith, …)
export default defineConfig({
  test: agbossTest({
    include: ["tests/**/*.test.ts"],
    // a test that asserts nothing proves nothing
    expect: { requireAssertions: true },
    // the local instances' shared PII key (R6: synthetic); nothing here calls a model, so no model key
    env: { PII_PSEUDONYM_KEY: "local-test-synthetic-pseudonym-key" },
  }),
});
