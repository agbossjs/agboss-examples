import { Workflow, writeToolsNeedApproval } from "graphcompose";
import { BUDGET, DEFAULTS, GUARDS, KIMI, KIMI_PRICE, ROUTERS } from "./config/settings.js";
import { Profiler } from "./agents/profiler.agent.js";
import { Scout } from "./agents/scout.agent.js";
import { Shortlist } from "./agents/shortlist.agent.js";
import { ShortlistServer } from "./mcp/shortlist.server.js";
import { NOTES_DB, NOTES_DIR, SHORTLIST, SHORTLIST_FILE } from "./config/paths.js";
import { NOTES_INDEX } from "./rag/company-notes.rag.js";
import { JobFitJudge } from "./services/job-fit.service.js";
import { ResumeReader } from "./services/resume-reader.service.js";
import { GreenhouseBoards } from "./services/greenhouse-boards.service.js";
import { jobScoutPromptVariables } from "./config/prompt-variables.js";
import { JOB_SEARCH, jobSearchConfig } from "./config/search.config.js";

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
    ResumeReader,
    GreenhouseBoards,
    { provide: JOB_SEARCH, useValue: jobSearchConfig },
    { provide: SHORTLIST, useValue: SHORTLIST_FILE },
    { provide: NOTES_INDEX, useValue: { folder: NOTES_DIR, dbFile: NOTES_DB } },
  ],
  promptVariables: jobScoutPromptVariables(jobSearchConfig),
  needsApproval: writeToolsNeedApproval,
})
export class JobScout {}
