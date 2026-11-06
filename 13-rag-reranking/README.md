# `13-rag-reranking` — The Answer the Retriever Ranked 27th, First

> **Priority:** P1 — knowledge bases, reranked
> **Principle:** Promise → Failure Injection → Reproducible Proof

> **Independent example, not affiliated.** Cohere is named only to identify its public rerank API.
> AGBoss is not affiliated with, endorsed by or sponsored by Cohere; "Cohere" is its owner's
> trademark. This example follows Cohere's public documentation and its official SDK
> [`cohere-ai`](https://www.npmjs.com/package/cohere-ai) 8.1.0 as read on 2026-11-02 —
> [Rerank API](https://docs.cohere.com/reference/rerank),
> [Rerank overview](https://docs.cohere.com/docs/rerank-overview),
> [pricing](https://cohere.com/pricing). Check them before relying on this code. No Cohere API is
> called: the SDK is pointed at a local stub of the documented endpoint.

A retriever, keyword or vector, often ranks the passage that answers below near-misses that repeat
the question's words. Reranking fixes that: fetch more candidates (30 here), re-order them with a
more precise model and give the agent the best few (3). In AGBoss a knowledge base opts in on its
`@Rag` declaration. Cohere Rerank plugs in on its own SDK as a code `@Reranker`, with no AGBoss
wrapper. Swapping it for AGBoss's own LLM reranker changes one line of that declaration.
Wiki: [Knowledge bases → Reranking](https://github.com/agbossjs/agboss/wiki/Knowledge-bases#reranking).

```ts
@Rag({
  name: "handbook-rag",
  description: "The engineering handbook: onboarding, on-call, tooling",
  rerank: { by: CohereReranker, candidates: 30, topK: 3 }, // or: by: HandbookLlmReranker
})
export class HandbookRag extends HandbookSearch {}
```

## 1. Engineering Promises Tested

| Promise | Threat / Failure Injected | AGBoss Mechanism | Executable Proof |
|---|---|---|---|
| **The relevant passage reaches the agent first** | The retriever ranks the answer 27th of 30, behind near-misses that repeat "on-call" | `@Rag({ rerank })`: 30 candidates → `@Reranker` → the best 3, in tool and in context mode | [`tests/reranking.test.ts`](./tests/reranking.test.ts) |
| **A dedicated rerank API on its official SDK** | A thin wrapper drifting from the vendor's SDK | `CohereReranker implements RerankerHandler` calls `CohereClientV2.rerank` itself; ~25 lines | [`src/rerankers/cohere.reranker.ts`](./src/rerankers/cohere.reranker.ts) |
| **The reranker's cost is a retrieval cost the budgets count** | A reranker billed outside the turn's financials | its `costUsd` (search units × your price) under `rag:handbook-rag`, category `retrieval` | › "tool mode …" (`result.spend`) |
| **A failing rerank API does not fail the answer** | Cohere answers 503 (twice: the SDK's own retry too) | `RerankFailurePolicy.Fallback` (default): the retriever's own first 3, a `rerank:<name>:fallback` span | [`tests/failure.test.ts`](./tests/failure.test.ts) |
| **Swapping the reranker is one line** | Coupling to a vendor | `by: HandbookLlmReranker` — the same retriever, candidates and topK | [`tests/swap.test.ts`](./tests/swap.test.ts) |
| **The reranker sees only the tenant's own candidates** | A reranker that could reorder (or inject) another tenant's passages | the core passes the tenant (#700) and keeps only a subset of the tenant's candidates | [`tests/tenants.test.ts`](./tests/tenants.test.ts): `ragConnectorContract` through Cohere |

## 2. Commands

```bash
npm ci
npm run demo     # the retriever's order, Cohere's reranked answer, its cost; a 503 and the fallback
npm test         # the same, asserted; the swap; the RAG contract through Cohere
npm run check    # agboss check + tsc + eslint
```

Offline and $0: no key, no network beyond `127.0.0.1`. The SDK is pinned exactly:
`cohere-ai@8.1.0`.

## 3. Layout

```
src/rag/handbook.rag.ts                  the knowledge base: retriever + rerank: { by, candidates, topK }
src/rag/handbook-search.ts               the retriever (the tenant's passages, near-misses first)
src/rerankers/cohere.reranker.ts         Cohere Rerank on cohere-ai: the wiring to copy
src/rerankers/handbook-llm.reranker.ts   AGBoss's LLM reranker on a cheap model: the swap
src/services/cohere-client.service.ts    the SDK's client, made once from the environment
src/stub/cohere-rerank.stub.ts           a local stub of the documented /v2/rerank (HTTP and in-process)
src/offline/offline-openrouter.ts        the demo's scripted OpenRouter wire
```

## 4. Guarantee Boundary

- **The stub follows the docs as read on 2026-11-02**: the endpoint, the request and response
  fields, a bearer token, search units. Cohere's ranking model is not public, so the stub's
  relevance is a stand-in (the share of the query's words a passage covers). It proves the wiring,
  not Cohere's quality.
- **The price is yours**: `USD_PER_SEARCH_UNIT` is a placeholder. Put your contract's price there;
  the budgets count what it says.
- **What AGBoss guarantees**: the reranker is called with the tenant's own candidates only, and its
  result reaches the agent only if it is a subset of them. A failure falls back (or fails the step
  under `RerankFailurePolicy.FailStep`). Its cost is in the turn's spend and every budget.
- **What stays the application's**: the key (`COHERE_API_KEY`), the rerank model, the price. The
  candidate texts are sent to Cohere as they are retrieved: the application's PII policies do not
  mask a code reranker's own API call.
- **A live run** (optional, your keys): `COHERE_API_KEY=… OPENROUTER_API_KEY=… PII_PSEUDONYM_KEY=… npx agboss run --start
  briefing-workflow-start "When does a new engineer join on-call?"` on the `dev` environment.
