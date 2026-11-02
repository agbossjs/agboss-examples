// Independent example, not affiliated with Cohere. It follows Cohere's public docs and its official
// SDK `cohere-ai` 8.1.0 as read on 2026-11-02: https://docs.cohere.com/reference/rerank
import { ApplicationContext, Injectable } from "@agboss/core";
import { CohereClientV2 } from "cohere-ai";
import type { AppEnvironment } from "../environments/app.environment.js";

/**
 * Cohere's official client, made once from the environment: the key, and the address — the local
 * stub offline, Cohere's own API when `cohereBaseUrl` is unset. No AGBoss wrapper around it.
 */
@Injectable({ deps: [ApplicationContext] })
export class CohereClientService {
  readonly client: CohereClientV2;

  constructor(applicationContext: ApplicationContext) {
    const environment = applicationContext.environment as AppEnvironment;
    const { cohereApiKey, cohereBaseUrl } = environment;
    this.client = new CohereClientV2({
      token: cohereApiKey?.reveal() ?? "offline-stub",
      ...(cohereBaseUrl === undefined ? {} : { baseUrl: cohereBaseUrl }),
      // the reranker's own failure policy decides; one retry of the SDK's own is enough
      maxRetries: 1,
    });
  }
}
