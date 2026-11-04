// The ledger stub's pod (agbossjs/agboss#487): the other system, outside AGBoss.
import { startLedgerStub } from "./stub/ledger-stub.js";

const stub = await startLedgerStub(Number(process.env.STUB_PORT ?? 8081));
console.log(`ledger stub on ${stub.url}`);
process.once("SIGTERM", () => {
  void stub.close();
});
