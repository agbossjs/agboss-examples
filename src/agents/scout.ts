import { GreenhouseJobs } from "../tools/greenhouse-jobs.js";
import { Agent } from "graphinject";
import { KIMI, KIMI_PRICE } from "../settings.js";

@Agent({
  name: "scout",
  description:
    "Searches Greenhouse with the agreed search brief and returns the best-fitting jobs with links",
  model: KIMI,
  price: KIMI_PRICE,
  // ranking is Jev's job; the scout only filters and formats — no reasoning to pay for
  thinking: "none",
  tools: [GreenhouseJobs],
  prompt: new URL("./scout.prompt.md", import.meta.url),
})
export class Scout {}
