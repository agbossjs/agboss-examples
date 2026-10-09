import "dotenv/config";
// eslint-disable-next-line no-restricted-imports
import { studioGraphOf } from "graphcompose/core";
import { JobScout } from "./job-scout.workflow.js";

/** job-scout in LangGraph Studio (`npm run studio` at the repo root; see langgraph.json). */
export const graph = await studioGraphOf(JobScout);
