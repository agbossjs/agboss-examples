import { scenariosBetween } from "../../scenarios/index.js";
import { describeRows } from "./scenario-rows.js";

// PS7–PS14: duplicates the application makes, deploys, clock skew, a lost commit
describeRows(scenariosBetween(7, 14));
