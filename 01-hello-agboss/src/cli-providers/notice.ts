import { Logger, LogLevel, type Clock } from "@agboss/core";

/**
 * The warning each provider logs at startup. agboss does not and cannot guarantee that running a
 * vendor's CLI from an application complies with the vendor's terms: it warns, the risk is yours.
 * The quotes are the vendors' own words, verbatim, with the pages they come from.
 */
const common = (provider: string, cli: string): string =>
  `${provider} runs your own ${cli} on your own plan. Demo / local testing only, not for production or commercial use. agboss does not and cannot guarantee that this use complies with the vendor's terms; the account risk is yours.`;

export const CODEX_NOTICE = `${common("codex-cli-model-provider", "codex CLI")} OpenAI documents \`codex exec\` for "users who need ChatGPT/Codex rate limits" — https://learn.chatgpt.com/docs/non-interactive-mode · terms: https://openai.com/policies/row-terms-of-use/`;

export const CLAUDE_QUOTES = {
  legal:
    "Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, Max, or Ultra plan credentials on behalf of their users.",
  sdk: "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK.",
} as const;

export const CLAUDE_NOTICE = `${common("claude-cli-model-provider", "claude CLI")} Anthropic says: "${CLAUDE_QUOTES.legal}" — https://code.claude.com/docs/en/legal-and-compliance · "${CLAUDE_QUOTES.sdk}" — https://code.claude.com/docs/en/agent-sdk/overview · You acknowledged this risk (acknowledgeVendorTermsRisk: true). A sanctioned alternative: the monthly API credits of Max/Ultra/Team plans, used with an API key.`;

export const GEMINI_QUOTE =
  "Directly accessing the services powering Gemini CLI (for example, the Gemini Code Assist service) using third-party software, tools, or services (for example, using OpenClaw with Gemini CLI OAuth) is a violation of applicable terms and policies. Such actions may be grounds for suspension or termination of your account.";

export const GEMINI_NOTICE = `${common("gemini-cli-model-provider", "gemini CLI")} Google says: "${GEMINI_QUOTE}" — https://github.com/google-gemini/gemini-cli/blob/main/docs/resources/tos-privacy.md · You acknowledged this risk (acknowledgeVendorTermsRisk: true). A sanctioned alternative: a free Google AI Studio key (read its data terms first).`;

export function warn(logger: Logger, clock: Clock, notice: string): void {
  logger.write({ code: "app.provider-notice", level: LogLevel.Warn, message: notice, time: clock.now() });
}
