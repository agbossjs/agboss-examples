import { scenariosBetween } from "../../scenarios/index.js";
import { describeRows } from "./scenario-rows.js";

// PS1–PS6: failures of the process (a timeout, a crash, a zombie) and the support levels
describeRows(scenariosBetween(1, 6));
