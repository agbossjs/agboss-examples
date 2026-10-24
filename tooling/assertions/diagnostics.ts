export interface ExtractedDiagnostic {
  readonly code: string;
  readonly line: string;
}

export interface CheckProblem {
  readonly file: string;
  readonly code: string;
  readonly message: string;
  readonly line?: number;
}

export interface CheckJsonReport {
  readonly ok: boolean;
  readonly result?: {
    readonly application: string;
    readonly checks: readonly string[];
    readonly problems: readonly CheckProblem[];
  };
  readonly error?: {
    readonly kind: string;
    readonly code: string;
    readonly message: string;
  };
}

export interface ExpectedDiagnostic {
  readonly expectedCode: string;
  readonly expectedWorkflowName?: string;
  readonly expectedStepName?: string;
}

const DIAGNOSTIC_PATTERN = /\[([a-z0-9-]+\.[a-z0-9-]+)\]/giu;

/**
 * Extracts bracketed AGBoss diagnostic codes (e.g. `[input.missing-on-path]`,
 * `[input.outdated-on-path]`, `[launch.branch-outdates-sibling]`, `[flow.uncompensated-action]`)
 * from CLI output.
 */
export function extractDiagnostics(output: string): readonly ExtractedDiagnostic[] {
  const found: ExtractedDiagnostic[] = [];
  for (const line of output.split(/\r?\n/u)) {
    for (const match of line.matchAll(DIAGNOSTIC_PATTERN)) {
      const code = match[1];
      if (code !== undefined) {
        found.push({ code, line: line.trim() });
      }
    }
  }
  return found;
}

/**
 * Verifies that the CLI output contains the expected diagnostic code and all required substrings
 * (such as workflow name, component name, or route).
 */
export function assertDiagnosticPresent(
  output: string,
  expectedCode: string,
  expectedLocations: readonly string[] = [],
): ExtractedDiagnostic {
  const diagnostics = extractDiagnostics(output);
  const matching = diagnostics.filter((d) => d.code === expectedCode);
  if (matching.length === 0) {
    throw new Error(
      `Expected diagnostic [${expectedCode}] not found in output.\nFound codes: ${
        diagnostics.map((d) => `[${d.code}]`).join(", ") || "(none)"
      }\nFull output:\n${output}`,
    );
  }
  for (const loc of expectedLocations) {
    const hasLoc = matching.some((d) => d.line.includes(loc)) || output.includes(loc);
    if (!hasLoc) {
      throw new Error(
        `Diagnostic [${expectedCode}] was found, but expected location "${loc}" was missing.\nMatching lines:\n${matching
          .map((d) => d.line)
          .join("\n")}`,
      );
    }
  }
  const first = matching[0];
  if (first === undefined) {
    throw new Error(`Expected diagnostic [${expectedCode}] not found.`);
  }
  return first;
}

/**
 * Parses JSON output from `agboss check --json`.
 */
export function parseCheckOutput(stdout: string): CheckJsonReport {
  const trimmed = stdout.trim();
  const jsonStart = trimmed.indexOf("{");
  if (jsonStart < 0) {
    throw new Error(`Expected JSON output from agboss check --json, got:\n${stdout}`);
  }
  return JSON.parse(trimmed.slice(jsonStart)) as CheckJsonReport;
}

/**
 * Verifies that `agboss check --json` reported a problem matching `expected`.
 */
export function assertDiagnosticMatch(
  report: CheckJsonReport,
  expected: ExpectedDiagnostic,
): CheckProblem {
  const problems = report.result?.problems ?? [];
  const matching = problems.filter((p) => p.code === expected.expectedCode);
  if (matching.length === 0) {
    throw new Error(
      `Expected diagnostic code "${expected.expectedCode}" in check report.\nFound problems:\n${JSON.stringify(
        problems,
        null,
        2,
      )}`,
    );
  }
  if (expected.expectedStepName !== undefined) {
    const withStep = matching.find((p) => p.message.includes(expected.expectedStepName!));
    if (withStep === undefined) {
      throw new Error(
        `Diagnostic "${expected.expectedCode}" found, but expected step "${
          expected.expectedStepName
        }" was not mentioned in message(s):\n${matching.map((m) => m.message).join("\n")}`,
      );
    }
    return withStep;
  }
  return matching[0]!;
}

/**
 * Verifies that `agboss check --json` succeeded with zero problems.
 */
export function assertZeroErrors(report: CheckJsonReport): void {
  const problems = report.result?.problems ?? [];
  if (!report.ok || problems.length > 0) {
    throw new Error(
      `Expected zero problems from agboss check --json, got:\n${JSON.stringify(
        problems,
        null,
        2,
      )}`,
    );
  }
}
