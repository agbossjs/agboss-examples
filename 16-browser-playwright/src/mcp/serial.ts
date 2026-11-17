/**
 * One at a time. @playwright/mcp keeps one page in one browser per connection: a navigation is the
 * session's state, and two tool calls at once (a model may issue several in one turn) would abort each
 * other's navigation (`net::ERR_ABORTED`, seen in the live run). A plain class, not a component: the
 * queue is the connection's, not an execution's.
 */
export class Serial {
  private tail: Promise<unknown> = Promise.resolve();

  /** Runs `work` after every earlier piece of work has ended, however it ended. */
  run<TResult>(work: () => Promise<TResult>): Promise<TResult> {
    const next = this.tail.then(work, work);
    this.tail = next.catch(() => undefined);
    return next;
  }
}

/** The one session of the Playwright MCP server: every tool that navigates takes its turn. */
export const PLAYWRIGHT_SESSION = new Serial();
