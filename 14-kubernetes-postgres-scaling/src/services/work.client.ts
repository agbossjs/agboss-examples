import { ApplicationContext, Injectable } from "@agboss/core";

/** What the remote work is told: the job and who works on it, under which lease token. */
export interface WorkRequest {
  readonly jobId: string;
  readonly durationMs: number;
  readonly executionId: string;
  readonly rootExecutionId: string;
  readonly instanceId: string;
  readonly pod: string;
  readonly token: number;
}

/**
 * The job's remote work (`POST <ledgerUrl>/work`): the other system works on the job and answers
 * when it is done. Like many SDK clients, it takes no `AbortSignal` — so a step whose lease was
 * lost meanwhile (a frozen pod, a partition) goes on to its write when the answer comes. That is
 * the zombie the fenced effect after it refuses (agbossjs/agboss#487, Wiki → Several-instances).
 */
@Injectable({ deps: [ApplicationContext] })
export class WorkClient {
  constructor(private readonly applicationContext: ApplicationContext) {}

  async work(request: WorkRequest): Promise<void> {
    const response = await fetch(`${this.applicationContext.environment.ledgerUrl}/work`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`the remote work failed: HTTP ${String(response.status)}`);
  }
}
