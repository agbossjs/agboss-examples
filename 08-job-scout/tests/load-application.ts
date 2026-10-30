/**
 * Loads `JobScoutApplication` before any test file runs. `workflowOf(JobScout)` assembles the
 * workflow in its application; when that application is not loaded yet, `@agboss/core@0.1.0`
 * imports `*.application.ts` with Node's own `import()`, which cannot run decorators. In the agboss
 * monorepo vitest inlined the linked package, so the import went through vite; from npm it does not.
 * Loading the application here makes every `workflowOf` find it already registered.
 */
import "../src/job-scout.application.js";
