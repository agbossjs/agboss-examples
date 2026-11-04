import { afterAll, beforeAll } from "vitest";
import { startLedgerStub, type LedgerStub } from "../../src/stub/ledger-stub.js";

/**
 * The ledger stub for one test file, on a free port: LEDGER_URL is set before any app of the file is
 * built (the local test environment reads it at start). `current()` is the running stub.
 */
export function ledgerStubForFile(): { readonly current: () => LedgerStub } {
  let stub: LedgerStub | undefined;
  beforeAll(async () => {
    stub = await startLedgerStub(0, "127.0.0.1");
    process.env.LEDGER_URL = stub.url;
  });
  afterAll(async () => {
    await stub?.close();
  });
  return {
    current: () => {
      if (stub === undefined) throw new Error("the stub starts in beforeAll");
      return stub;
    },
  };
}
