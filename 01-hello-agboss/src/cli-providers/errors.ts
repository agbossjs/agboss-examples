/** The CLI started a tool of its own: the run is killed, the call fails. */
export class CliNativeToolError extends Error {
  constructor(readonly eventType: string) {
    super(`cli.native-tool-used: the CLI tried to run its own tool (${eventType}); the run was killed`);
    this.name = "CliNativeToolError";
  }
}

/** The CLI's reply was not a valid turn (not retried). */
export class CliInvalidOutputError extends Error {
  constructor(reason: string, head: string) {
    super(`cli.invalid-output: ${reason}: ${head.slice(0, 500)}`);
    this.name = "CliInvalidOutputError";
  }
}

/** The CLI is missing, or not logged in: say what to run. */
export class CliSetupError extends Error {
  constructor(message: string) {
    super(`cli.setup: ${message}`);
    this.name = "CliSetupError";
  }
}

/** A plain-JavaScript caller left out `acknowledgeVendorTermsRisk: true`. */
export class RiskNotAcknowledgedError extends Error {
  constructor(vendor: string) {
    super(
      `cli.risk-not-acknowledged: ${vendor} needs { acknowledgeVendorTermsRisk: true }; read the vendor's terms first`,
    );
    this.name = "RiskNotAcknowledgedError";
  }
}
