import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const folder = mkdtempSync(join(tmpdir(), "safe-payments-"));
let count = 0;
process.on("exit", () => { rmSync(folder, { recursive: true, force: true }); });

/**
 * Points `SQLITE_PATH` (what the application's storage reads in place of `:memory:`) at a new file, the one
 * the NEXT test's two instances share and no other test sees. The storage reads the path when the test's
 * fixtures are set up, before its body: a test cannot choose its own file, so each test ends by choosing the
 * next one's (and the file is chosen once at load, for the first).
 */
export function nextInstancesFile(): void {
  count += 1;
  process.env.SQLITE_PATH = join(folder, `test-${String(count)}.sqlite`);
}

nextInstancesFile();
