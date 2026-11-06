import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import { FLOW_CHAIN_RULE, agbossPlugin } from "@agboss/core/eslint";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules", "dist", "coverage", ".agboss"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      "src/**/*.ts",
      "triage-gateway/**/*.ts",
      "billing-service/**/*.ts",
      "catalog-mcp/**/*.ts",
    ],
    ignores: ["**/*.test.ts", "src/demo.ts"],
    plugins: { agboss: agbossPlugin },
    rules: { "agboss/no-component-state": "error", "agboss/no-direct-time": "error" },
  },
  {
    files: ["**/*.workflow.ts"],
    plugins: { "@stylistic": stylistic },
    rules: FLOW_CHAIN_RULE,
  },
  {
    // @agboss/core/internal is the agboss CLI's, with no semver promise: every file imports the
    // public entries only (agbossjs/agboss#818)
    files: ["**/*.{ts,mts,cts,js,mjs,cjs}"],
    plugins: { agboss: agbossPlugin },
    rules: { "agboss/no-internal-import": "error" },
  },
);
