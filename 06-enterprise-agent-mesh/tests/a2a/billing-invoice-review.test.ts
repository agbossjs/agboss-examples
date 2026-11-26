import { TaskState, type StreamResponse } from "@a2a-js/sdk";
import { A2A_SKILLS_EXTENSION, A2AClient } from "@agboss/core/a2a";
import { FileDto, WorkflowFinishTextDto } from "@agboss/core/dto";
import { replyWith, testWith } from "@agboss/core/testing";
import { describe, expect } from "vitest";
import {
  BillingA2AEndpoint,
  BillingHttpAuthenticator,
  BillingApplication,
} from "../../apps/2-billing-a2a/src/billing.application.js";
import { InvoiceReviewRequestDto } from "../../apps/2-billing-a2a/src/dto/invoice-review-request.dto.js";
import { InvoiceReviewerAgent } from "../../apps/2-billing-a2a/src/agents/invoice-reviewer/invoice-reviewer.agent.js";
import { InvoiceReplyJudge } from "../../apps/2-billing-a2a/src/judges/invoice-reply.judge.js";
import {
  chunkOf,
  INVOICE_CSV,
  QUESTION,
  questionPart,
  rawPart,
  reviewParams,
  reviewRequest,
  rpc,
  sdkClientOf,
  shownAfter,
} from "./billing-wire.js";

const test = testWith(BillingApplication);
const billing = { endpoint: BillingA2AEndpoint, authenticator: BillingHttpAuthenticator };
const ANSWER = "INV-5001 has 3 line items totalling 43500.00 USD.";
const JUDGE_NOTE = "PASS: internal audit note, total checked";

/** The states of the status updates (and of the task event), in the order they came. */
const statesOf = (events: readonly StreamResponse[]): string[] =>
  events.flatMap((event) =>
    event.payload?.$case === "task" || event.payload?.$case === "statusUpdate"
      ? [TaskState[event.payload.value.status?.state ?? 0] ?? "?"]
      : [],
  );

describe("The invoice review over A2A message/stream (SSE)", () => {
  test("the status updates and the answer arrive as the task runs; only the answer is streamed (#1004)", async ({
    a2aServer,
    mockModel,
  }) => {
    mockModel(InvoiceReviewerAgent).thenReturn(replyWith(ANSWER));
    mockModel(InvoiceReplyJudge).thenReturn(replyWith(JUDGE_NOTE));
    const { url } = await a2aServer(billing);
    const client = await sdkClientOf(url);

    const events: StreamResponse[] = [];
    let stateWhenAnswerStarted: TaskState | undefined;
    for await (const event of client.sendMessageStream(reviewRequest("review-1"))) {
      events.push(event);
      if (chunkOf(event) !== undefined && stateWhenAnswerStarted === undefined) {
        const taskId = event.payload?.$case === "artifactUpdate" ? event.payload.value.taskId : "";
        const task = await client.getTask({ tenant: "", id: taskId, historyLength: undefined });
        stateWhenAnswerStarted = task.status?.state;
      }
    }

    const states = statesOf(events);
    const chunks = events.flatMap((event) => chunkOf(event) ?? []);
    // the task is announced first and ends COMPLETED; the answer's chunks come between, not after
    expect(states[0]).not.toBe("TASK_STATE_COMPLETED");
    expect(states.at(-1)).toBe("TASK_STATE_COMPLETED");
    expect(states).toContain("TASK_STATE_WORKING");
    const lastChunkAt = events.findLastIndex((event) => chunkOf(event) !== undefined);
    const completedAt = events.findIndex(
      (event) => event.payload?.$case === "statusUpdate" && event.payload.value.status?.state === TaskState.TASK_STATE_COMPLETED,
    );
    expect(lastChunkAt).toBeLessThan(completedAt);
    // a client that reads the answer while the task still runs: the stream is no replay of a finished task
    expect(stateWhenAnswerStarted).toBe(TaskState.TASK_STATE_WORKING);
    // nothing but the answer: the judge ran, and its words are in no chunk and no status
    expect(mockModel(InvoiceReplyJudge).requests).toHaveLength(1);
    expect(shownAfter(chunks)).toBe(ANSWER);
    const wire = JSON.stringify(events);
    expect(wire).not.toContain("audit note");
    expect(wire).not.toContain("AUDIT RUBRIC");
  });

  test("the invoice sent as a file part is read by the agent's model, as the CSV's own text", async ({
    a2aServer,
    mockModel,
  }) => {
    const reviewer = mockModel(InvoiceReviewerAgent).thenReturn(replyWith(ANSWER));
    mockModel(InvoiceReplyJudge).thenReturn(replyWith("PASS"));
    const { url } = await a2aServer(billing);
    const client = await sdkClientOf(url);

    for await (const event of client.sendMessageStream(reviewRequest("review-file-1"))) expect(event).toBeDefined();

    const [request] = reviewer.requests;
    const shown = JSON.stringify(request);
    expect(shown).toContain("GPU rack,2,18000");
    expect(shown).toContain("invoice.csv");
    expect(shown).toContain(QUESTION);
  });
});

describe("Files over A2A: what the door lets in", () => {
  test("a CSV file part is accepted and the task completes with the agent's answer", async ({
    a2aServer,
    mockModel,
  }) => {
    mockModel(InvoiceReviewerAgent).thenReturn(replyWith(ANSWER));
    mockModel(InvoiceReplyJudge).thenReturn(replyWith("PASS"));
    const { url } = await a2aServer(billing);

    const sent = await rpc(
      url,
      reviewParams("m-ok", [questionPart, rawPart(new TextEncoder().encode(INVOICE_CSV), "text/csv", "invoice.csv")]),
    );

    const task = (sent.body.result as { task: { status: { state: string }; artifacts: { parts: { text?: string }[] }[] } }).task;
    expect(task.status.state).toBe("TASK_STATE_COMPLETED");
    expect(task.artifacts[0]?.parts[0]?.text).toBe(ANSWER);
  });

  test("the gateway's typed client sends the invoice with FileDto.fromBytes and gets the text answer", async ({
    a2aServer,
    mockModel,
  }) => {
    mockModel(InvoiceReviewerAgent).thenReturn(replyWith(ANSWER));
    mockModel(InvoiceReplyJudge).thenReturn(replyWith("PASS"));
    const { url } = await a2aServer(billing);
    const client = new A2AClient({
      url,
      headers: { authorization: "Bearer key-acme" },
      contract: {
        application: "billing-application",
        skill: "invoice-review-workflow-start",
        input: InvoiceReviewRequestDto,
        output: WorkflowFinishTextDto,
      },
    });

    const answer = await client.execute({
      question: QUESTION,
      invoice: FileDto.fromBytes(new TextEncoder().encode(INVOICE_CSV), {
        mediaType: "text/csv",
        filename: "invoice.csv",
      }),
    });

    expect(answer).toEqual({ text: ANSWER });
  });

  const refused: readonly {
    readonly name: string;
    readonly parts: () => readonly unknown[];
    readonly code: string;
  }[] = [
    {
      name: "a PNG, which the skill does not take (only text/csv)",
      parts: () => [questionPart, rawPart(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png", "invoice.png")],
      code: "a2a.file-media-type",
    },
    {
      name: "a CSV over the skill's 8 KB",
      parts: () => [questionPart, rawPart(new TextEncoder().encode(`sku,qty,unit_usd\n${"GPU rack,1,1\n".repeat(900)}`), "text/csv", "big.csv")],
      code: "a2a.file-too-large",
    },
    {
      name: "bytes that are no text, called a CSV",
      parts: () => [questionPart, rawPart(Uint8Array.from([0xff, 0xfe, 0x00, 0x01]), "text/csv", "invoice.csv")],
      code: "a2a.media-type-mismatch",
    },
    {
      name: "a descriptor in a data part (a file field is the server's, never the caller's)",
      parts: () => [{ data: { question: QUESTION, invoice: { mediaType: "text/csv", url: "https://files.example/invoice.csv" } }, mediaType: "application/json" }],
      code: "a2a.file-field-in-data",
    },
  ];

  for (const { name, parts, code } of refused) {
    test(`${name} is refused with ${code}, and nothing runs`, async ({ a2aServer, mockModel }) => {
      const { url } = await a2aServer(billing);

      const sent = await rpc(url, reviewParams(`m-${code}`, parts()));

      expect(JSON.stringify(sent.body)).toContain(code);
      expect(mockModel(InvoiceReviewerAgent).requests).toHaveLength(0);
    });
  }
});

describe("The billing card", () => {
  test("lists the review skill with the one media type it takes", async ({ a2aServer }) => {
    const { url } = await a2aServer(billing);

    const card = (await (await fetch(`${url}/.well-known/agent-card.json`, { headers: { authorization: "Bearer key-acme" } })).json()) as {
      skills: { id: string; inputModes: string[] }[];
      capabilities: { extensions: { uri: string; params: { skills: Record<string, { files?: Record<string, { mediaTypes: string[] }> }> } }[] };
    };

    expect(card.skills.map((skill) => skill.id).sort()).toEqual(["billing-workflow-start", "invoice-review-workflow-start"]);
    const extension = card.capabilities.extensions.find((entry) => entry.uri === A2A_SKILLS_EXTENSION);
    expect(extension?.params.skills["invoice-review-workflow-start"]?.files?.invoice?.mediaTypes).toEqual(["text/csv"]);
  });
});
