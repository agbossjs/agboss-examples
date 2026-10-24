import js from "@eslint/js";
import { agbossPlugin } from "agboss/eslint";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules", "dist", "coverage", ".agboss"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.test.ts", "src/demo.ts"],
    plugins: { agboss: agbossPlugin },
    rules: { "agboss/no-component-state": "error", "agboss/no-direct-time": "error" },
  },
);
