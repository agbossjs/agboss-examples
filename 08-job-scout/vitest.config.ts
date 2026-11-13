import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";
import { agbossVitest } from "@agboss/core/testing/vitest";

export default defineConfig({
  // agbossVitest() loads AGBoss — and the application testWith(JobScoutApplication) assembles — through
  // vite, with its decorators, and registers the workflow matchers (toFollowPath, toFinishWith, …)
  test: agbossVitest({
    include: ["tests/**/*.test.ts"],
    // a test that asserts nothing proves nothing (#180)
    expect: { requireAssertions: true },
    // tests/demo.test.ts runs `npm run demo` as a child process
    testTimeout: 120_000,
    // the shortlist MCP server writes to a temp folder in tests, never to ~/job-scout
    env: { JOB_SCOUT_DIR: join(tmpdir(), "job-scout-tests") },
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
