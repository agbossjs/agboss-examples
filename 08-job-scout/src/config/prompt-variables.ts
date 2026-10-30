import type { JobSearch } from "./search.config.js";

/** Prompt variables from the search config: the boards and places job-scout knows. */
export function jobScoutPromptVariables(search: JobSearch): Record<string, string> {
  const places = Object.keys(search.places);
  return {
    boards: Object.entries(search.boards)
      .map(([token, name]) => `${token} (${name})`)
      .join(", "),
    boardCount: String(Object.keys(search.boards).length),
    knownPlaces:
      places.length === 0
        ? "Locations are matched literally."
        : `Places the search knows (they also match their cities): ${places.join(", ")}.`,
  };
}
