import { defineConfig } from "vitest/config";
import { agbossVitest } from "@agboss/core/testing/vitest";

// agbossVitest() loads AGBoss through vite, in the tests' module graph, and registers the workflow
// matchers (toFollowPath, toFinishWith, toHaveHandledError, …)
export default defineConfig({
  test: agbossVitest({
    include: ["tests/**/*.test.ts"],
    // a test that asserts nothing proves nothing
    expect: { requireAssertions: true },
    // tests/demo.test.ts runs the demo in a process
    testTimeout: 120_000,
    // no test starts a Chrome: the fake browser factory, and the one fake site on the allowlist; the
    // MCP server's child (tests/mcp.test.ts) inherits both
    env: { BROWSER_FACTORY: "fake", BROWSER_ALLOWED_ORIGINS: "https://docs.example.com", PII_PSEUDONYM_KEY: "browser-bot-bypass-offline-pseudonym-key" },
    // (a synthetic PII key for the tests only; the application fails closed without its own)
  }),
});
