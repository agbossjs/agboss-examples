import { readFileSync } from "node:fs";

/**
 * The fixture Greenhouse board API of `npm run demo` and `tests/demo.test.ts`: the boards in
 * `fixtures/greenhouse/<board>.json` (synthetic jobs in Greenhouse's own response shape), served for
 * `GET {greenhouseApiUrl}/v1/boards/<board>/jobs`. One board is down on purpose — the failure
 * injection: `taboola` answers 503, and the search must report it instead of failing.
 */

/** The boards with a fixture file. */
export const FIXTURE_BOARDS = ["fireblocks", "similarweb", "jfrog"] as const;

/** The board that is down (503) in every offline run. */
export const DOWN_BOARD = "taboola";

const boardFile = (board: string): URL => new URL(`./greenhouse/${board}.json`, import.meta.url);

/** One fixture board, as the board API returns it. */
export function fixtureBoard(board: (typeof FIXTURE_BOARDS)[number]): {
  jobs: { title: string; absolute_url: string; location: { name: string } }[];
} {
  return JSON.parse(readFileSync(boardFile(board), "utf8")) as ReturnType<typeof fixtureBoard>;
}

export interface FixtureGreenhouse {
  /** Global `fetch` with the board API answered from fixtures; every other URL goes to `next`. */
  readonly fetch: typeof fetch;
  /** Every board URL asked for, in order. */
  readonly requests: readonly string[];
}

/** Serves the fixture boards under `apiUrl`; other requests go to `next` (the offline guard). */
export function createFixtureGreenhouse(apiUrl: string, next: typeof fetch): FixtureGreenhouse {
  const requests: string[] = [];
  const fixtureFetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(`${apiUrl}/v1/boards/`)) return next(input, init);
    requests.push(url);
    const board = decodeURIComponent(/\/v1\/boards\/([^/]+)\/jobs/.exec(url)?.[1] ?? "");
    if (board === DOWN_BOARD)
      return Promise.resolve(new Response("Service Unavailable", { status: 503 }));
    if (!(FIXTURE_BOARDS as readonly string[]).includes(board))
      return Promise.resolve(new Response("Not Found", { status: 404 }));
    return Promise.resolve(
      new Response(readFileSync(boardFile(board), "utf8"), {
        headers: { "content-type": "application/json" },
      }),
    );
  }) as typeof fetch;
  return { fetch: fixtureFetch, requests };
}
