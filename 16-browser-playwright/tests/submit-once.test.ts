/**
 * The form's submit is the side effect, and it is filed once (agbossjs/agboss#1261): an outbound
 * call (an intent recorded in a fenced write before the browser leaves, `recovery` after an unknown
 * outcome) keyed by the request's own `reference` as a business key. A retry, a second call, a second
 * execution and the takeover after a crash file one ticket — read from the site's own records.
 * Red-first evidence: the same tests against a bare click (the PR's sabotage table) file two.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect } from "vitest";
import { callTool, replyWith, testWith } from "@agboss/core/testing";
import { WebAgent } from "../src/agents/web.agent.js";
import { BrowserPlaywrightApplication } from "../src/browser-playwright.application.js";
import { SiteFault } from "../src/site/contact-site.js";
import { SubmitContact } from "../src/tools/submit-contact.tool.js";
import { AskWorkflowStart } from "../src/workflows/web/ask.workflow-start.js";
import { ContactWorkflowStart } from "../src/workflows/web/contact.workflow-start.js";
import { frozenPastLease, settled, until } from "./support/steps.js";
import { siteForFile } from "./support/site.js";

const { site } = siteForFile();

const REQUEST = { reference: "callback-1042", name: "Ada", email: "ada@example.com", message: "Please call me back about the Team plan." };
const posts = (): number => site().requests.filter((request) => request === "POST /contact").length;
const lookups = (): number => site().requests.filter((request) => request === "GET /api/tickets").length;

describe("one ticket per reference", () => {
  const test = testWith(BrowserPlaywrightApplication, { allowNetwork: ["127.0.0.1"] });

  test("the same request twice (two executions): the second gets the first receipt and the browser is not opened", async ({ app }) => {
    const tickets = site().tickets.length;
    const first = await app.execute(ContactWorkflowStart, { ...REQUEST, reference: "twice-1" });
    const formOpens = site().requests.filter((request) => request === "GET /contact").length;
    const second = await app.execute(ContactWorkflowStart, { ...REQUEST, reference: "twice-1" });

    expect(first.output).toEqual({ ticketId: expect.stringMatching(/^T-\d+$/u) as string });
    expect(second.output).toEqual(first.output);
    // the site files the idempotency key (a keyed fingerprint), not the reference: count the tickets
    expect(site().tickets).toHaveLength(tickets + 1);
    expect(site().requests.filter((request) => request === "GET /contact")).toHaveLength(formOpens);
  });

  test("a lost answer (the site filed the ticket, a proxy answered 502): the step fails with an unknown outcome; the next attempt looks the ticket up and files nothing new", async ({ app }) => {
    const before = { tickets: site().tickets.length, posts: posts(), lookups: lookups() };
    site().inject(SiteFault.BadGatewayAfterProcessing);

    const lost = await settled(app.execute(ContactWorkflowStart, { ...REQUEST, reference: "lost-answer-1" }));
    expect(lost).not.toBe("finished");
    expect(site().tickets).toHaveLength(before.tickets + 1);

    const retried = await app.execute(ContactWorkflowStart, { ...REQUEST, reference: "lost-answer-1" });

    expect(retried.output).toEqual({ ticketId: site().tickets.at(-1)?.id });
    expect(site().tickets).toHaveLength(before.tickets + 1);
    expect(posts()).toBe(before.posts + 1); // one POST, ever
    expect(lookups()).toBe(before.lookups + 1); // the retry asked the site what happened
  });

  test("a lost answer, the retry, and a third submit: still one ticket, the same receipt", async ({ app }) => {
    site().inject(SiteFault.BadGatewayAfterProcessing);
    await settled(app.execute(ContactWorkflowStart, { ...REQUEST, reference: "lost-answer-2" }));
    const retried = await app.execute(ContactWorkflowStart, { ...REQUEST, reference: "lost-answer-2" });
    const before = { tickets: site().tickets.length, posts: posts(), lookups: lookups() };

    const again = await app.execute(ContactWorkflowStart, { ...REQUEST, reference: "lost-answer-2" });

    expect(again.output).toEqual(retried.output);
    expect(site().tickets).toHaveLength(before.tickets);
    expect(posts()).toBe(before.posts);
    expect(lookups()).toBe(before.lookups); // the stored result is replayed: the site is not asked again
  });

  test("the same reference with another message is a conflict: nothing is sent", async ({ app }) => {
    await app.execute(ContactWorkflowStart, { ...REQUEST, reference: "conflict-1" });
    const before = { tickets: site().tickets.length, requests: site().requests.length };

    const failure = await settled(app.execute(ContactWorkflowStart, { ...REQUEST, reference: "conflict-1", message: "A different message" }));

    expect(failure).not.toBe("finished");
    expect(site().tickets).toHaveLength(before.tickets);
    expect(site().requests).toHaveLength(before.requests);
  });

  test("the model repeats its tool call: one ticket, the same receipt twice", async ({ app, mockModel }) => {
    const call = { ...REQUEST, reference: "model-repeats-1" };
    mockModel(WebAgent).thenReturn(callTool(SubmitContact, call), callTool(SubmitContact, call), replyWith("filed"));
    const before = site().tickets.length;

    const result = await app.execute(AskWorkflowStart, { text: "file my request" });

    expect(result.toolCalls.map((each) => each.status)).toEqual(["succeeded", "succeeded"]);
    expect(result.toolCalls[1]?.output).toEqual(result.toolCalls[0]?.output);
    expect(site().tickets).toHaveLength(before + 1);
  });
});

describe("a crash in the middle of the submit", () => {
  // the two instances share one SQLite file (`SQLITE_PATH`, what the storage reads in place of `:memory:`)
  const folder = mkdtempSync(join(tmpdir(), "browser-playwright-"));
  beforeAll(() => {
    process.env.SQLITE_PATH = join(folder, "crash.sqlite");
  });
  afterAll(() => {
    process.env.SQLITE_PATH = ":memory:";
    rmSync(folder, { recursive: true, force: true });
  });
  const test = testWith(BrowserPlaywrightApplication, {
    instances: 2,
    allowNetwork: ["127.0.0.1"],
  });

  test("instance 1 freezes after the site filed the ticket and before it heard back; instance 2 recovers the run and files nothing new", async ({ apps, clock, leases }) => {
    await Promise.all(apps.map((each) => each.ready()));
    const [first, second] = apps;
    if (first === undefined || second === undefined) throw new Error("two instances");
    const before = { tickets: site().tickets.length, posts: posts() };
    site().inject(SiteFault.HoldAnswer);

    const zombie = settled(first.execute(ContactWorkflowStart, { ...REQUEST, reference: "crash-1" }));
    await until(() => site().heldCount === 1, "the site filed the ticket and holds its answer");
    expect(site().tickets).toHaveLength(before.tickets + 1);
    await frozenPastLease({ apps, clock, leases }, first);
    // instance 2 took the lease over and ran the step again: it found the pending intent, asked the site
    await until(() => lookups() >= 1, "the recovery asked the site what happened");
    site().release();
    await zombie;

    expect(site().tickets).toHaveLength(before.tickets + 1);
    expect(posts()).toBe(before.posts + 1);
  });
});
