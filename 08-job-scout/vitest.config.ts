import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";
import { agbossTest } from "@agboss/core/testing/vitest";

export default defineConfig({
  // agbossTest() loads AGBoss — and the application workflowOf(JobScout) assembles in — through
  // vite, with its decorators, and registers the workflow matchers (toFollowPath, toFinishWith, …)
  test: agbossTest({
    include: ["tests/**/*.test.ts"],
    // a test that asserts nothing proves nothing (#180)
    expect: { requireAssertions: true },
    // tests/demo.test.ts runs `npm run demo` as a child process
    testTimeout: 120_000,
    // the shortlist MCP server writes to a temp folder in tests, never to ~/job-scout
    // and the application's PII key: fixed and synthetic (R6), the same tokens on every run
    env: { JOB_SCOUT_DIR: join(tmpdir(), "job-scout-tests"), PII_PSEUDONYM_KEY: "job-scout-test-synthetic-pseudonym-key" },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // entry points: the boards probe script and the demo (run as a process by tests/demo.test.ts)
      exclude: ["src/scripts/**", "src/demo.ts"],
      reporter: ["text", "json-summary"],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  }),
});
