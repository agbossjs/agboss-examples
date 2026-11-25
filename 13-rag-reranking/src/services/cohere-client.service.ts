// Independent example, not affiliated with Cohere. It follows Cohere's public docs and its official
// SDK `cohere-ai` 8.1.0 as read on 2026-11-02: https://docs.cohere.com/reference/rerank
import { Injectable, defineEnv, env, secret, type InferEnv } from "@agboss/core";
import { CohereClientV2 } from "cohere-ai";

/**
 * What the Cohere SDK needs, read once when the application starts: the key (a live run only; offline
 * the stub takes any) and the address — the local stub offline, Cohere's own API when `COHERE_BASE_URL` is unset.
 */
export const cohereEnv = defineEnv({
  apiKey: secret.optional("COHERE_API_KEY"),
  baseUrl: env.optional("COHERE_BASE_URL"),
});

/**
 * Cohere's official client, made once from `cohereEnv`. No AGBoss wrapper around it.
 */
@Injectable({ deps: [cohereEnv] })
export class CohereClientService {
  readonly client: CohereClientV2;

  constructor({ apiKey, baseUrl }: InferEnv<typeof cohereEnv>) {
    this.client = new CohereClientV2({
      token: apiKey?.reveal() ?? "offline-stub",
      ...(baseUrl === undefined ? {} : { baseUrl }),
      // the reranker's own failure policy decides; one retry of the SDK's own is enough
      maxRetries: 1,
    });
  }
}
