import { Router } from "graphcompose/router";
import { Profiler } from "../agents/profiler.agent.js";
import { Scout } from "../agents/scout.agent.js";
import { Shortlist } from "../agents/shortlist.agent.js";
import { ChatWorkflowFinish } from "../workflow-finishes/chat.workflow-finish.js";

/** Sends each message to the agent that handles it, and the turn to the answer once it is covered. */
@Router({
  name: "main",
  description: "Sends the job seeker's message to the right agent, or sends the answer",
  prompt:
    "Pick who handles the job seeker's message next. Send the answer when the contributions so far already cover the message.",
  model: "typesafe/jev-1.13",
  maxVisits: 3,
  routes: [
    { target: Profiler, prompt: "Reading the resume and proposing a search brief" },
    { target: Scout, prompt: "Finding and ranking jobs" },
    { target: Shortlist, prompt: "Saving chosen jobs to the shortlist, or showing it" },
    { target: ChatWorkflowFinish, prompt: "Stop and send the answer: the contributions so far answer the message, or the last agent asked the job seeker a question and waits for the reply, or it cannot be done (for example the job seeker rejected a required action)" }
  ],
})
export class MainRouter {}
