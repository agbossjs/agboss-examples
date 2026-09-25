import { GreenhouseJobs } from "../tools/greenhouse-jobs.js";
import { Agent } from "graphcompose";
import { CompanyNotes } from "../rag/company-notes.js";
import { KIMI, KIMI_PRICE } from "../settings.js";

@Agent({
  name: "scout",
  description:
    "Searches Greenhouse with the agreed search brief and returns the best-fitting jobs with links",
  model: KIMI,
  price: KIMI_PRICE,
  // a ceiling: a model stuck in a repetition loop stops here instead of generating for minutes
  maxTokens: 4000,
  // ranking is Jev's job; the scout only filters and formats — no reasoning to pay for
  thinking: "none",
  tools: [GreenhouseJobs],
  rag: [{ use: CompanyNotes, mode: "tool" }],
  prompt: new URL("./scout.prompt.md", import.meta.url),
})
export class Scout {}
