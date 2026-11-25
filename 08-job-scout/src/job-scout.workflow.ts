import { Workflow, provide, onStart, toAgent, Ttl } from "@agboss/core";
import { ConversationMemory } from "./memories/conversation.memory.js";
import { ProfilerAgent } from "./agents/profiler.agent.js";
import { PersonalDataGuardrail } from "./guardrails/personal-data.guardrail.js";
import { PromptInjectionGuardrail } from "./guardrails/prompt-injection.guardrail.js";
import { ScoutAgent } from "./agents/scout.agent.js";
import { ShortlistAgent } from "./agents/shortlist.agent.js";
import { ChatWorkflowStart } from "./workflow-starts/chat.workflow-start.js";
import { ChatWorkflowFinish } from "./workflow-finishes/chat.workflow-finish.js";
import { MainRouter } from "./routers/main.router.js";
import { ShortlistServer } from "./mcp/shortlist.server.js";
import { NOTES_DB, NOTES_DIR, SHORTLIST, SHORTLIST_FILE } from "./config/paths.js";
import { CompanyNotes, NOTES_INDEX } from "./rag/company-notes.rag.js";
import { JobFitJudge } from "./services/job-fit.service.js";
import { ResumeReader } from "./services/resume-reader.service.js";
import { GreenhouseBoards } from "./services/greenhouse-boards.service.js";
import { jobScoutPromptVariables } from "./config/prompt-variables.js";
import { JOB_SEARCH, jobSearchConfig } from "./config/search.js";

/**
 * Resume from disk → proposed brief → Greenhouse jobs ranked by Jev, explained with the user's company
 * notes, the chosen ones saved to a shortlist (a write the user approves). One path per turn: the
 * message goes to the main router, which sends it to the agent that answers; the thread carries the
 * conversation from turn to turn.
 */
@Workflow({
  name: "job-scout-workflow",
  version: "3.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(ChatWorkflowStart)
      .toRouter(MainRouter)
      .onRoute(toAgent(ProfilerAgent)
          .toFinish(ChatWorkflowFinish))
      .onRoute(toAgent(ScoutAgent)
          .toFinish(ChatWorkflowFinish))
      .onRoute(toAgent(ShortlistAgent)
          .toFinish(ChatWorkflowFinish)),
  ],
  guardrails: [PromptInjectionGuardrail, PersonalDataGuardrail], // every agent's; the router: input only
  memory: ConversationMemory, // the last 8 turns in full; older turns: summaries of 5, the latest 10 kept
  providers: [
    ShortlistServer, // the MCP server its tools call (connected at start)
    JobFitJudge,
    CompanyNotes, // the knowledge base the notes tool injects
    ResumeReader,
    GreenhouseBoards,
    provide(JOB_SEARCH, jobSearchConfig),
    provide(SHORTLIST, SHORTLIST_FILE),
    provide(NOTES_INDEX, { directory: NOTES_DIR, path: NOTES_DB }),
  ],
  promptVariables: jobScoutPromptVariables(jobSearchConfig),
})
export class JobScout {}
