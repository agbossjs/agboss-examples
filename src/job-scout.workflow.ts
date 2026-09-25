import { Workflow, writeToolsNeedApproval } from "graphinject";
import { BUDGET, DEFAULTS, GUARDS, KIMI, KIMI_PRICE, ROUTERS } from "./settings.js";
import { Profiler } from "./agents/profiler.js";
import { Scout } from "./agents/scout.js";
import { Shortlist } from "./agents/shortlist.js";
import { ShortlistServer } from "./mcp/shortlist.js";
import { NOTES_DB, NOTES_DIR, SHORTLIST_FILE } from "./paths.js";
import { NOTES_INDEX } from "./rag/company-notes.js";
import { JobFitJudge } from "./fit.js";
import { jobScoutPromptVariables } from "./prompt-variables.js";
import { JOB_SEARCH, jobSearchConfig } from "./search.config.js";

/**
 * Resume from disk → proposed brief → Greenhouse jobs ranked by Jev, explained with the user's company
 * notes, the chosen ones saved to a shortlist (a write the user approves).
 */
@Workflow({
  name: "job-scout",
  version: "1.2.0",
  defaults: { ...DEFAULTS, history: { limit: 8 } },
  budget: { ...BUDGET, runBudgetCap: 0.1 },
  routers: ROUTERS,
  guards: GUARDS,
  compaction: { every: 5, keep: 10, model: { model: KIMI, thinking: "none", price: KIMI_PRICE } },
  agents: [Profiler, Scout, Shortlist],
  mcp: [ShortlistServer],
  providers: [
    JobFitJudge,
    { provide: JOB_SEARCH, useValue: jobSearchConfig },
    { provide: NOTES_INDEX, useValue: { folder: NOTES_DIR, dbFile: NOTES_DB } },
  ],
  promptVariables: { ...jobScoutPromptVariables(jobSearchConfig), shortlistFile: SHORTLIST_FILE },
  needsApproval: writeToolsNeedApproval,
})
export class JobScout {}
