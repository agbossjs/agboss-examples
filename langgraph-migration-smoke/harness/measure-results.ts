import { LEGACY_STATE_FIELD_NAMES, runLegacySupportGraph } from "../source/legacy-langgraph/support.graph.js";
import { verifyPackagedCodingAgentSkills } from "./create-clean-project.js";
import { runCodingAgentMigration } from "./run-coding-agent.js";
import { validateMigratedProject } from "./validate-output.js";

export interface MigrationScorecard {
  readonly mode: "offline-reference" | "external-agent";
  readonly legacyStateFieldsCount: number;
  readonly legacyBugsReproduced: {
    readonly firstWriteSawUndefinedDraft: boolean;
    readonly firstWriteSawUndefinedCritique: boolean;
    readonly unusedFieldPersisted: boolean;
  };
  readonly skillsPackagedCount: number;
  readonly migrationGuidePresent: boolean;
  readonly narrowDtosCount: number;
  readonly agbossCheckPassed: boolean;
  readonly zeroLangGraphImportsInSrc: boolean;
}

export async function measureMigrationBenchmark(): Promise<MigrationScorecard> {
  const legacyTrace = await runLegacySupportGraph({
    orderId: "7",
    customerId: "CUST-1",
    customerEmail: "alice.synth@example.com",
    message: "My order came late, refund it please",
    requestedRefundCents: 2_500,
  });

  const skills = await verifyPackagedCodingAgentSkills();
  const agentRun = await runCodingAgentMigration();
  const validation = await validateMigratedProject();

  return {
    mode: agentRun.mode,
    legacyStateFieldsCount: LEGACY_STATE_FIELD_NAMES.length,
    legacyBugsReproduced: {
      firstWriteSawUndefinedDraft: legacyTrace.firstWritePromptSawUndefinedDraft,
      firstWriteSawUndefinedCritique: legacyTrace.readonlyfirstWritePromptSawUndefinedCritique,
      unusedFieldPersisted: legacyTrace.unusedFieldPersistedInState,
    },
    skillsPackagedCount: skills.referenceFilesFound.length,
    migrationGuidePresent: skills.migrationGuidePresent && skills.migrationGuideMentionsFourSteps,
    narrowDtosCount: validation.dtoClassesCount,
    agbossCheckPassed: validation.agbossCheckPassed && validation.agbossCheckProblemCount === 0,
    zeroLangGraphImportsInSrc: validation.zeroLangGraphImportsInSrc,
  };
}
