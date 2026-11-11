import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import { FLOW_CHAIN_RULE, agbossPlugin } from "@agboss/core/eslint";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules", "dist", "coverage", ".agboss", ".artifacts"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-extraneous-class": ["error", { allowWithDecorator: true }],
    },
  },
  {
    files: ["src/**/*.ts"],
    // the demo is a script around the app
    ignores: ["src/demo.ts"],
    plugins: { agboss: agbossPlugin },
    rules: { "agboss/no-component-state": "error", "agboss/no-direct-time": "error" },
  },
  {
    files: ["**/*.workflow.ts"],
    plugins: { "@stylistic": stylistic },
    rules: FLOW_CHAIN_RULE,
  },
  {
    // @agboss/core/internal is the agboss CLI's, with no semver promise (agbossjs/agboss#818)
    files: ["**/*.{ts,mts,cts,js,mjs,cjs}"],
    plugins: { agboss: agbossPlugin },
    rules: { "agboss/no-internal-import": "error" },
  },
  { files: ["**/*.js"], ...tseslint.configs.disableTypeChecked },
);
