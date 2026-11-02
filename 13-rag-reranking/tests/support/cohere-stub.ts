import { afterAll, beforeAll } from "vitest";
import { CohereRerankStub } from "../../src/stub/cohere-rerank.stub.js";

/**
 * The local Cohere stub for one test file: started before the file's applications are made, its
 * address in `COHERE_BASE_URL` (which `test.environment.ts` reads), stopped after.
 */
export function cohereStubForFile(): CohereRerankStub {
  const stub = new CohereRerankStub();
  beforeAll(async () => {
    process.env.COHERE_BASE_URL = await stub.start();
  });
  afterAll(() => stub.stop());
  return stub;
}
