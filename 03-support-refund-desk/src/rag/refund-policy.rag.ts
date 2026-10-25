import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Rag, type RagConnector, type RagRetrieval } from "agboss/rag";

const FIXTURES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures");
const CURRENT_POLICY_MD = readFileSync(join(FIXTURES_DIR, "refund-policy-current.md"), "utf8");
const OLD_POLICY_MD = readFileSync(join(FIXTURES_DIR, "refund-policy-old.md"), "utf8");

let activePolicyVersion: "current" | "old" = "current";

export function setActivePolicyVersion(version: "current" | "old"): void {
  activePolicyVersion = version;
}

export function getActivePolicyVersion(): "current" | "old" {
  return activePolicyVersion;
}

@Rag({
  name: "refund-policy-rag",
  description: "Active customer support refund policy knowledge base",
  topK: 3,
})
export class RefundPolicyRag implements RagConnector {
  retrieve(_query: string, options: { readonly topK: number }): Promise<RagRetrieval> {
    const markdown = activePolicyVersion === "current" ? CURRENT_POLICY_MD : OLD_POLICY_MD;
    const sourceFile =
      activePolicyVersion === "current" ? "refund-policy-current.md" : "refund-policy-old.md";
    const sections = markdown
      .split(/\n(?=##\s)/u)
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 0)
      .slice(0, options.topK)
      .map((text, idx) => ({
        text,
        source: `${sourceFile}#section-${idx + 1}`,
      }));
    return Promise.resolve({ results: sections });
  }
}
