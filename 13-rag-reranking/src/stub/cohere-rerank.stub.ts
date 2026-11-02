// Independent example, not affiliated with Cohere. A local stand-in for Cohere's rerank endpoint as
// its public docs describe it, read on 2026-11-02: https://docs.cohere.com/reference/rerank
// (POST /v2/rerank; `model`, `query`, `documents`, `top_n`; `results[].index` and
// `relevance_score`; `meta.billed_units.search_units`; a bearer token required). Cohere's model is not
// public: the stub's relevance is a stand-in — the share of the query's words a document covers.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

/** One request the stub answered, as it read it. */
export interface RerankCall {
  readonly model: string;
  readonly query: string;
  readonly documents: readonly string[];
  readonly topN: number;
}

const STOP_WORDS = new Set(["when", "does", "what", "with", "that", "this", "from", "their"]);

/** The query's words of four letters and more, each as its first five letters. */
const wordsOf = (text: string): readonly string[] => [
  ...new Set(
    (text.toLowerCase().match(/[a-z]{4,}/gu) ?? [])
      .filter((word) => !STOP_WORDS.has(word))
      .map((word) => word.slice(0, 5)),
  ),
];

/** The stand-in relevance: the share of the query's words the document covers, 0 to 1. */
export function relevanceOf(query: string, document: string): number {
  const words = wordsOf(query);
  const covered = new Set(wordsOf(document));
  return words.length === 0 ? 0 : words.filter((word) => covered.has(word)).length / words.length;
}

/** The stub: its calls, and a failure to answer the next request with (Cohere's documented codes). */
export class CohereRerankStub {
  readonly calls: RerankCall[] = [];
  private failures: number[] = [];
  private server: Server | undefined;

  /** The next `times` requests answer `status` (`503` unavailable, `429` too many requests). */
  failNext(status: number, times = 1): void {
    this.failures = Array.from({ length: times }, () => status);
  }

  async start(port = 0): Promise<string> {
    const server = createServer((request, response) => {
      void this.answer(request, response);
    });
    this.server = server;
    await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
    return `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  }

  async stop(): Promise<void> {
    const { server } = this;
    if (server !== undefined) await new Promise((resolve) => server.close(resolve));
  }

  /**
   * The stub as a `fetch` the SDK can take (`new CohereClientV2({ fetch })`): the same answers, in
   * process — for a suite that runs outside `testWith`, where the network is closed.
   */
  readonly fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const { status, body } = this.respond({
      method: request.method,
      path: new URL(request.url).pathname,
      authorization: request.headers.get("authorization") ?? "",
      body: await request.text(),
    });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };

  private async answer(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    const { status, body } = this.respond({
      method: request.method ?? "",
      path: request.url ?? "",
      authorization: request.headers.authorization ?? "",
      body: Buffer.concat(chunks).toString("utf8"),
    });
    response.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
  }

  /** One request, as the docs describe the endpoint's answers. */
  private respond(request: {
    readonly method: string;
    readonly path: string;
    readonly authorization: string;
    readonly body: string;
  }): { readonly status: number; readonly body: unknown } {
    if (request.method !== "POST" || request.path !== "/v2/rerank")
      return { status: 404, body: { message: "not found" } };
    if (!/^Bearer \S+/u.test(request.authorization))
      return { status: 401, body: { message: "no api key supplied" } };
    const failure = this.failures.shift();
    if (failure !== undefined) return { status: failure, body: { message: "stub failure" } };
    const body = JSON.parse(request.body) as Record<string, unknown>;
    const documents = Array.isArray(body.documents) ? body.documents.map(String) : [];
    const query = typeof body.query === "string" ? body.query : "";
    const topN = typeof body.top_n === "number" ? body.top_n : documents.length;
    this.calls.push({ model: String(body.model), query, documents, topN });
    const results = documents
      .map((document, index) => ({ index, relevance_score: relevanceOf(query, document) }))
      .sort((left, right) => right.relevance_score - left.relevance_score || left.index - right.index)
      .slice(0, topN);
    // a search unit is one query over up to 100 documents
    const searchUnits = Math.max(1, Math.ceil(documents.length / 100));
    const meta = { api_version: { version: "2" }, billed_units: { search_units: searchUnits } };
    return { status: 200, body: { id: `rerank-${String(this.calls.length)}`, results, meta } };
  }
}
