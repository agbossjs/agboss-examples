import { Agent } from "graphcompose";
import { ReadShortlist } from "../mcp/read-shortlist.mcp.js";
import { SaveShortlist } from "../mcp/save-shortlist.mcp.js";
import { KIMI, KIMI_PRICE } from "../config/settings.js";

@Agent({
  name: "shortlist",
  description: "Saves the jobs the user chooses to their shortlist file and shows what is on it",
  model: KIMI,
  price: KIMI_PRICE,
  // a ceiling: a model stuck in a repetition loop stops here instead of generating for minutes
  maxTokens: 1000,
  // matching "save 3" to the list needs a little care
  thinking: "low",
  tools: [ReadShortlist, SaveShortlist],
})
export class Shortlist {}
