import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Injectable } from "@agboss/core";

const FIXTURES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures");
const CURRENT_POLICY_MD = readFileSync(join(FIXTURES_DIR, "refund-policy-current.md"), "utf8");
const OLD_POLICY_MD = readFileSync(join(FIXTURES_DIR, "refund-policy-old.md"), "utf8");

export type PolicyVersion = "current" | "old";

let activePolicyVersion: PolicyVersion = "current";

export function setActivePolicyVersion(version: PolicyVersion): void {
  activePolicyVersion = version;
}

export function getActivePolicyVersion(): PolicyVersion {
  return activePolicyVersion;
}

export interface IndexedPolicyChunk {
  readonly policyId: string;
  readonly title: string;
  readonly text: string;
  readonly source: string;
  readonly version: PolicyVersion;
  readonly termFrequencies: ReadonlyMap<string, number>;
  readonly length: number;
}

export interface ScoredPolicyChunk {
  readonly policyId: string;
  readonly text: string;
  readonly source: string;
  readonly score: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .split(/\s+/u)
    .filter((token) => token.length >= 2);
}

function parseMarkdownSections(
  markdown: string,
  sourceFile: string,
  version: PolicyVersion,
): IndexedPolicyChunk[] {
  const sections = markdown
    .split(/\n(?=##\s)/u)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith("## "));

  return sections.map((section, idx) => {
    const firstLineEnd = section.indexOf("\n");
    const headerLine = firstLineEnd >= 0 ? section.slice(0, firstLineEnd) : section;
    const bracketMatch = /\[([a-z0-9-]+)\]/iu.exec(headerLine);
    const policyId = bracketMatch?.[1] ?? `section-${String(idx + 1)}`;
    const title = headerLine.replace(/^##\s*\d*\.?\s*/u, "").trim();
    const tokens = tokenize(section);
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }

    return {
      policyId,
      title,
      text: section,
      source: `${sourceFile}#${policyId}`,
      version,
      termFrequencies: tf,
      length: Math.max(tokens.length, 1),
    };
  });
}

/**
 * In-memory knowledge index implementing BM25 / TF-IDF token ranking over the active
 * and superseded refund policy markdown fixtures.
 */
@Injectable()
export class InMemoryKnowledgeIndexService {
  private readonly currentChunks = parseMarkdownSections(
    CURRENT_POLICY_MD,
    "refund-policy-current.md",
    "current",
  );
  private readonly oldChunks = parseMarkdownSections(
    OLD_POLICY_MD,
    "refund-policy-old.md",
    "old",
  );

  search(
    query: string,
    options: { readonly topK: number; readonly version?: PolicyVersion } = { topK: 3 },
  ): readonly ScoredPolicyChunk[] {
    const version = options.version ?? activePolicyVersion;
    const corpus = version === "current" ? this.currentChunks : this.oldChunks;
    const queryTokens = [...new Set(tokenize(query))];

    if (queryTokens.length === 0) {
      return corpus.slice(0, options.topK).map((chunk) => ({
        policyId: chunk.policyId,
        text: chunk.text,
        source: chunk.source,
        score: 0.5,
      }));
    }

    const avgDocLen =
      corpus.reduce((sum, doc) => sum + doc.length, 0) / Math.max(corpus.length, 1);
    const k1 = 1.5;
    const b = 0.75;

    const rawScored = corpus.map((doc, orderIdx) => {
      let rawScore = 0;
      for (const term of queryTokens) {
        const tf = doc.termFrequencies.get(term) ?? 0;
        if (tf === 0) continue;
        const docFreq = corpus.filter((d) => d.termFrequencies.has(term)).length;
        const idf = Math.log(1 + (corpus.length - docFreq + 0.5) / (docFreq + 0.5));
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (doc.length / avgDocLen));
        rawScore += idf * (numerator / denominator);
      }
      return { doc, rawScore, orderIdx };
    });

    rawScored.sort((a, bItem) =>
      bItem.rawScore !== a.rawScore
        ? bItem.rawScore - a.rawScore
        : a.orderIdx - bItem.orderIdx,
    );

    const maxScore = Math.max(...rawScored.map((item) => item.rawScore), 1);
    return rawScored.slice(0, options.topK).map(({ doc, rawScore }) => ({
      policyId: doc.policyId,
      text: doc.text,
      source: doc.source,
      score: Math.min(1, Math.max(0.05, Math.round((rawScore / maxScore) * 1000) / 1000)),
    }));
  }
}
