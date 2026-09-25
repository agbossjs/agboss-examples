import { Workflow } from "graphinject";
import { BUDGET, DEFAULTS, GUARDS, KIMI, KIMI_PRICE, ROUTERS } from "./settings.js";
import { Profiler } from "./agents/profiler.js";
import { Scout } from "./agents/scout.js";
import { JobFitJudge } from "./fit.js";
import { jobScoutPromptVariables } from "./prompt-variables.js";
import { JOB_SEARCH, jobSearchConfig } from "./search.config.js";

/** Resume from disk → proposed brief → Greenhouse search judged by Jev, in a chat loop. */
@Workflow({
  name: "job-scout",
  version: "1.1.0",
  defaults: { ...DEFAULTS, history: { limit: 8 } },
  budget: { ...BUDGET, runBudgetCap: 0.1 },
  routers: ROUTERS,
  guards: GUARDS,
  compaction: { every: 5, keep: 10, model: { model: KIMI, thinking: "none", price: KIMI_PRICE } },
  agents: [Profiler, Scout],
  providers: [JobFitJudge, { provide: JOB_SEARCH, useValue: jobSearchConfig }],
  promptVariables: jobScoutPromptVariables(jobSearchConfig),
})
export class JobScout {}
