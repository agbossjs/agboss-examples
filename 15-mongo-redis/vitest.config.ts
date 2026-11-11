import { defineConfig } from "vitest/config";
import { agbossVitest } from "@agboss/core/testing/vitest";

// agbossVitest() loads AGBoss through vite, in the tests' module graph, and registers the workflow
// matchers (toFollowPath, toFinishWith, …); the store packages are inlined beside it, so their classes
// are decorated by the one @agboss/core the tests load
export default defineConfig({
  test: agbossVitest({
    include: ["tests/**/*.test.ts"],
    server: { deps: { inline: [/@agboss\/(mongodb|redis)/] } },
    // a test that asserts nothing proves nothing
    expect: { requireAssertions: true },
  }),
});
