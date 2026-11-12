import { describe, expect, it } from "vitest";
import { claudeCliModelProvider } from "../../src/cli-providers/claude-cli.provider.js";
import { CodexCliModelProvider } from "../../src/cli-providers/codex-cli.provider.js";
import { RiskNotAcknowledgedError } from "../../src/cli-providers/errors.js";
import { geminiCliModelProvider } from "../../src/cli-providers/gemini-cli.provider.js";
import { MemoryLogger, RealClock } from "./harness.js";

// the vendors' own words, as quoted in agbossjs/agboss#951 (R1, R2, R11)
const ANTHROPIC_R1 =
  "Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, Max, or Ultra plan credentials on behalf of their users.";
const ANTHROPIC_R2 =
  "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK.";
const GOOGLE_R11 =
  "Directly accessing the services powering Gemini CLI (for example, the Gemini Code Assist service) using third-party software, tools, or services (for example, using OpenClaw with Gemini CLI OAuth) is a violation of applicable terms and policies. Such actions may be grounds for suspension or termination of your account.";

describe("the risk flag (typed as the literal true)", () => {
  it("is a compile error without it, with false, or with a plain boolean; a thrown error in plain JavaScript", () => {
    // @ts-expect-error the flag is required
    expect(() => claudeCliModelProvider({})).toThrow(RiskNotAcknowledgedError);
    // @ts-expect-error false is not the literal true
    expect(() => geminiCliModelProvider({ acknowledgeVendorTermsRisk: false })).toThrow(RiskNotAcknowledgedError);
    const flag = process.argv.length >= 0; // a plain boolean
    // @ts-expect-error a boolean is not the literal true
    expect(() => claudeCliModelProvider({ acknowledgeVendorTermsRisk: flag })).not.toThrow();
  });

  it("makes a provider with the flag, each call a new class; Codex needs none", () => {
    const first = claudeCliModelProvider({ acknowledgeVendorTermsRisk: true });
    expect(claudeCliModelProvider({ acknowledgeVendorTermsRisk: true })).not.toBe(first);
    expect(new CodexCliModelProvider(new MemoryLogger(), new RealClock())).toBeDefined();
  });
});

describe("each provider warns at startup: it does not refuse", () => {
  const warned = (build: (logger: MemoryLogger) => unknown): string => {
    const logger = new MemoryLogger();
    build(logger);
    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]?.level).toBe("warn");
    return logger.entries[0]?.message ?? "";
  };
  const common = ["Demo / local testing only", "the account risk is yours", "does not and cannot guarantee"];

  it("Claude: the vendor's prohibition verbatim, with its URLs", () => {
    const Claude = claudeCliModelProvider({ acknowledgeVendorTermsRisk: true });
    const text = warned((logger) => new Claude(logger, new RealClock()));
    for (const part of [...common, ANTHROPIC_R1, ANTHROPIC_R2, "https://code.claude.com/docs/en/legal-and-compliance", "https://code.claude.com/docs/en/agent-sdk/overview", "API credits"]) {
      expect(text).toContain(part);
    }
  });

  it("Gemini: the vendor's prohibition verbatim, with its URL", () => {
    const Gemini = geminiCliModelProvider({ acknowledgeVendorTermsRisk: true });
    const text = warned((logger) => new Gemini(logger, new RealClock()));
    for (const part of [...common, GOOGLE_R11, "https://github.com/google-gemini/gemini-cli/blob/main/docs/resources/tos-privacy.md", "AI Studio"]) {
      expect(text).toContain(part);
    }
  });

  it("Codex: a short demo-only note with OpenAI's links", () => {
    const text = warned((logger) => new CodexCliModelProvider(logger, new RealClock()));
    for (const part of [...common, "https://learn.chatgpt.com/docs/non-interactive-mode", "https://openai.com/policies/row-terms-of-use/"]) {
      expect(text).toContain(part);
    }
  });
});
