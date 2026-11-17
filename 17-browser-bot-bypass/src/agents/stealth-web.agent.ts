import { Agent } from "@agboss/core";
import { OpenPageStealth } from "../tools/open-page-stealth.tool.js";

/** Way A: an agent whose tool drives the application's shared stealth browser. */
@Agent({
  name: "stealth-web-agent",
  description: "Reads allowed web pages in a real, headed Chrome",
  prompt: "You read web pages for the user with open-page-stealth-tool. Answer in two sentences.",
  model: "openai/gpt-4.1-nano",
  tools: [OpenPageStealth],
})
export class StealthWebAgent {}
