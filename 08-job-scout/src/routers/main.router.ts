import { DecidedBy, Router, inline } from "@agboss/core";
import { WorkflowStartTextDto } from "@agboss/core/dto";
import { ProfilerAgent } from "../agents/profiler.agent.js";
import { ScoutAgent } from "../agents/scout.agent.js";
import { ShortlistAgent } from "../agents/shortlist.agent.js";
import { DecisionsModelProvider } from "../model-providers/openrouter.model-provider.js";

/** Sends each message of the chat to the agent that answers it; the thread keeps the turns before. */
@Router({
  name: "main-router",
  description: "Sends the job seeker's message to the agent that answers it",
  decidedBy: DecidedBy.Model,
  prompt: inline("Pick the agent that answers the job seeker's message."),
  model: "typesafe/jev-1.13",
  modelProvider: DecisionsModelProvider, // a decision model needs a decisions provider
  // what Jev decides on: the message (and the thread's earlier turns)
  input: { message: WorkflowStartTextDto },
  maxVisits: 1,
  routes: [
    { prompt: "Reading the resume and proposing a search brief", target: ProfilerAgent },
    { prompt: "Finding and ranking jobs", target: ScoutAgent },
    { prompt: "Saving chosen jobs to the shortlist, or showing it", target: ShortlistAgent },
  ],
})
export class MainRouter {}
