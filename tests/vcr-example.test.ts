process.env.OPENROUTER_API_KEY = "dummy-key";
process.env.OPENAI_API_KEY = "dummy-key";
import { testWith, VCRMode } from "graphcompose/testing";
import { expect } from "vitest";
import { JobScout } from "../src/job-scout.workflow.js";

const test = testWith(JobScout, {
  vcr: {
    cassetteName: "job-scout-brief",
    mode: VCRMode.REPLAY,
  },
});

test("демонстрация работы VCR (Снапшоты) в job-scout", async ({ app }) => {
  // Для наглядности
  expect(app).toBeDefined();
});
