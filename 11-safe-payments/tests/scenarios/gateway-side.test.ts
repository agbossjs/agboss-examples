import { scenariosBetween } from "../../scenarios/index.js";
import { describeRows } from "./scenario-rows.js";

// PS15–PS23: the gateway's side — webhooks, retention, captures, refunds, 3DS, in-flight duplicates
describeRows(scenariosBetween(15, 23));
