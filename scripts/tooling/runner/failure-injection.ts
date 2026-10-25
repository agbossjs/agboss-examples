export interface FaultTrigger {
  readonly stepName: string;
  readonly attempt?: number;
  readonly kind: "throw" | "abort";
  readonly errorMessage: string;
}

export interface FaultInjectionLogEntry {
  readonly stepName: string;
  readonly attempt: number;
  readonly triggered: boolean;
  readonly timestamp: number;
}

/**
 * Deterministic fault-injection controller for saga and recovery scenarios (Rule R3).
 * Allows tests to trigger an error or simulated worker crash on a specific step and attempt.
 */
export class FaultInjector {
  private readonly counts = new Map<string, number>();
  private readonly triggers = new Map<string, FaultTrigger>();
  private readonly log: FaultInjectionLogEntry[] = [];

  register(trigger: FaultTrigger): void {
    this.triggers.set(trigger.stepName, trigger);
  }

  clear(): void {
    this.counts.clear();
    this.triggers.clear();
    this.log.length = 0;
  }

  entries(): readonly FaultInjectionLogEntry[] {
    return [...this.log];
  }

  checkpoint(stepName: string): void {
    const attempt = (this.counts.get(stepName) ?? 0) + 1;
    this.counts.set(stepName, attempt);
    const trigger = this.triggers.get(stepName);
    const shouldTrigger =
      trigger !== undefined && (trigger.attempt === undefined || trigger.attempt === attempt);
    this.log.push({
      stepName,
      attempt,
      triggered: shouldTrigger,
      timestamp: Date.now(),
    });
    if (shouldTrigger) {
      const error = new Error(trigger.errorMessage);
      error.name = trigger.kind === "abort" ? "SimulatedWorkerCrashError" : "InjectedFaultError";
      throw error;
    }
  }
}
