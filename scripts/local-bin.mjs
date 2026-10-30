// A tool a project installed, run from its own `node_modules/.bin` (agbossjs/agboss#523): never
// `npx <tool>`, which downloads whatever is newest when the project lacks it.
import { join } from "node:path";

/** The path of `name` in `project`'s `node_modules/.bin`. */
export function localBinOf(project, name) {
  return join(project, "node_modules", ".bin", name);
}
