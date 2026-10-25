import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const EXPECTED_SKILL_REFERENCES: readonly string[] = [
  "01-composition-and-architecture.md",
  "02-flow-dsl-all-combinations.md",
  "03-components-di-and-lifecycle.md",
  "04-mcp-and-a2a.md",
  "05-channels-and-human-in-the-loop.md",
  "06-finops-providers-and-queues.md",
  "07-guardrails-pii-and-security.md",
  "08-observability-and-tracing.md",
  "09-persistence-k8s-and-deploy.md",
  "10-testing-vcr-and-evals.md",
  "11-cli-studio-and-error-catalog.md",
  "12-end-to-end-recipes.md",
  "13-migrating-from-langgraph.md",
] as const;

export interface SkillVerificationSummary {
  readonly skillEntryExists: boolean;
  readonly referenceFilesFound: readonly string[];
  readonly migrationGuidePresent: boolean;
  readonly migrationGuideMentionsFourSteps: boolean;
  readonly promptPath: string;
}

export async function verifyPackagedCodingAgentSkills(
  projectRoot: string = PACKAGE_ROOT,
): Promise<SkillVerificationSummary> {
  const skillsDir = join(projectRoot, "node_modules", "agboss", "skills", "agboss");
  const skillMdPath = join(skillsDir, "SKILL.md");
  const refsDir = join(skillsDir, "references");

  const skillMdContent = await readFile(skillMdPath, "utf8");
  const entries = (await readdir(refsDir)).filter((name) => name.endsWith(".md")).sort();

  const migrationGuidePath = join(refsDir, "13-migrating-from-langgraph.md");
  const migrationGuideContent = await readFile(migrationGuidePath, "utf8");

  return {
    skillEntryExists: skillMdContent.includes("AGBoss"),
    referenceFilesFound: entries,
    migrationGuidePresent: entries.includes("13-migrating-from-langgraph.md"),
    migrationGuideMentionsFourSteps:
      migrationGuideContent.includes("Step 1") &&
      migrationGuideContent.includes("Step 2") &&
      migrationGuideContent.includes("Step 3") &&
      migrationGuideContent.includes("Step 4"),
    promptPath: join(projectRoot, "prompts", "migrate.md"),
  };
}
