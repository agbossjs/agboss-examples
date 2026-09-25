import { ReadResume } from "../tools/read-resume.js";
import { Agent } from "graphinject";
import { KIMI, KIMI_PRICE } from "../settings.js";

@Agent({
  name: "profiler",
  description:
    "Reads the user's resume, interviews them about the jobs they want and agrees a search brief",
  model: KIMI,
  price: KIMI_PRICE,
  tools: [ReadResume],
  prompt: new URL("./profiler.prompt.md", import.meta.url),
})
export class Profiler {}
