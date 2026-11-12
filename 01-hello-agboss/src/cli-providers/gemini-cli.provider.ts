import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Clock, Logger } from "@agboss/core";
import { ModelProvider } from "@agboss/core/models";
import type { ModelProviderHandler, ModelProviderRequest, ModelProviderResponse } from "@agboss/core/models";
import { completeViaCli, type VendorSpec } from "./cli-turn.js";
import { CliNativeToolError, RiskNotAcknowledgedError } from "./errors.js";
import { GEMINI_NOTICE, warn } from "./notice.js";
import { CLI_PROVIDER_POLICY } from "./provider-policy.js";
import { isJson } from "./strict-schema.js";

// the CLI's project settings and a deny-all policy: files in OUR temp directory, loaded with
// --skip-trust and --admin-policy; the user's own gemini config directory is never touched
const SETTINGS = {
  mcpServers: {},
  hooksConfig: { enabled: false },
  skills: { enabled: false },
  general: { checkpointing: { enabled: false } },
  tools: { core: [] },
  context: { fileName: "AGBOSS_NO_CONTEXT.md" },
};
const DENY_ALL = '[[rule]]\ntoolName = "*"\ndecision = "deny"\npriority = 999\n';

const GEMINI: VendorSpec = {
  name: "gemini",
  prefix: "gemini-cli",
  binaryEnv: "AGBOSS_GEMINI_BINARY",
  defaultBinary: "gemini",
  extraEnv: ["GOOGLE_CLOUD_PROJECT"],
  loginHint: "run `gemini` once and sign in",
  inlineSchema: true, // no schema flag: the schema goes in the prompt, the reply is parsed
  prepare: async (dir) => {
    await mkdir(join(dir, ".gemini"), { recursive: true });
    await mkdir(join(dir, "policy"), { recursive: true });
    await writeFile(join(dir, ".gemini", "settings.json"), JSON.stringify(SETTINGS));
    await writeFile(join(dir, "policy", "deny-all.toml"), DENY_ALL);
  },
  args: ({ dir, model }) =>
    Promise.resolve([
      "-p", "", "--output-format", "stream-json", "--skip-trust", "--approval-mode", "default",
      "--admin-policy", join(dir, "policy"), "--allowed-mcp-server-names", "__none__",
      ...(model === undefined ? [] : ["-m", model]),
    ]),
  stdin: ({ instructions, body }) => `${instructions}\n${body}`,
  reader: () => {
    let text = "";
    let done = false;
    let usage = { inputTokens: 0, outputTokens: 0 };
    return {
      onEvent: (event) => {
        if (!isJson(event)) return;
        const type = String(event["type"]);
        if (type === "tool_use" || type === "tool_result") throw new CliNativeToolError(type);
        if (type === "message" && event["role"] === "assistant" && typeof event["content"] === "string") {
          text += event["content"];
        }
        if (type === "result") {
          done = event["status"] !== "error";
          const stats = isJson(event["stats"]) ? event["stats"] : {};
          usage = {
            inputTokens: Number(stats["input_tokens"] ?? 0),
            outputTokens: Number(stats["output_tokens"] ?? 0),
          };
        }
      },
      finding: () => (done ? { reply: text, usage } : undefined),
    };
  },
};

/**
 * `gemini -p` on a Google login. Google's Gemini CLI terms prohibit third-party access to its services
 * (see the startup warning): it is made only with `acknowledgeVendorTermsRisk: true`.
 */
export function geminiCliModelProvider(options: { readonly acknowledgeVendorTermsRisk: true }) {
  const acknowledged: unknown = options.acknowledgeVendorTermsRisk; // plain JavaScript may leave it out
  if (acknowledged !== true) throw new RiskNotAcknowledgedError("gemini-cli");

  @ModelProvider({
    name: "gemini-cli-model-provider",
    description: "Your own gemini CLI (gemini -p) on your own login; demo / local only, terms risk acknowledged",
    serves: [/^gemini-cli\//u, /^openai\//u],
    ...CLI_PROVIDER_POLICY,
    deps: [Logger, Clock],
  })
  class GeminiCliModelProvider implements ModelProviderHandler {
    constructor(
    logger: Logger,
    private readonly clock: Clock,
  ) {
      warn(logger, clock, GEMINI_NOTICE);
    }

    complete(request: ModelProviderRequest): Promise<ModelProviderResponse> {
      return completeViaCli(GEMINI, request, this.clock);
    }
  }
  return GeminiCliModelProvider;
}
