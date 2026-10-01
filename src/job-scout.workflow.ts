import { Workflow, writeToolsNeedApproval } from "graphcompose";
import { from, WorkflowSettings, type WorkflowDefinition } from "graphcompose/graph";
import { usd } from "graphcompose/units";
import { DEFAULTS, GUARDS, KIMI, KIMI_PRICE } from "./config/settings.js";
import { Profiler } from "./agents/profiler.agent.js";
import { Scout } from "./agents/scout.agent.js";
import { Shortlist } from "./agents/shortlist.agent.js";
import { ChatWorkflowStart } from "./workflow-starts/chat.workflow-start.js";
import { ChatWorkflowFinish } from "./workflow-finishes/chat.workflow-finish.js";
import { MainRouter } from "./routers/main.router.js";
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
 * notes, the chosen ones saved to a shortlist (a write the user approves). The graph is a star: the
 * message goes to the main router, which sends it to an agent and back, until it sends the answer.
 */
@Workflow({
  name: "job-scout",
  version: "2.0.0",
  flow: [
    from(ChatWorkflowStart).to(MainRouter),
    from(MainRouter).choose(Profiler, Scout, Shortlist, ChatWorkflowFinish),
    from(Profiler, Scout, Shortlist).to(MainRouter),
  ],
  defaults: { ...DEFAULTS, history: { limit: 8 } },
  guards: GUARDS,
  compaction: { every: 5, keep: 10, model: { model: KIMI, thinking: "none", price: KIMI_PRICE } },
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
export class JobScout implements WorkflowDefinition {
  settings(): WorkflowSettings {
    return WorkflowSettings.builder()
      .limits({ perRun: { steps: 12, cost: usd(0.1) }, perDay: { cost: usd(1) } })
      .build();
  }
}
