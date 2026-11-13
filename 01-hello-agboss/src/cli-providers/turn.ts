import { randomUUID } from "node:crypto";
import type { ModelProviderRequest, ModelProviderResponse, ModelProviderToolDefinition } from "@agboss/core/models";
import { ModelProviderMessageRole } from "@agboss/core/models";
import { CliInvalidOutputError } from "./errors.js";
import { dropNulls, isJson, strict, type Json } from "./strict-schema.js";

type Tool = ModelProviderToolDefinition;

const escapeText = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const escapeAttr = (text: string): string => escapeText(text).replaceAll('"', "&quot;");

/** The per-turn union: `{kind:"text", text}` or `{kind:"tool_calls", calls}`, one `anyOf` entry per tool. */
export function envelopeSchema(tools: readonly Tool[]): Json {
  const kind = (values: readonly string[]): Json => ({ type: "string", enum: values });
  if (tools.length === 0) {
    return {
      type: "object",
      additionalProperties: false,
      required: ["kind", "text", "calls"],
      properties: { kind: kind(["text"]), text: { type: "string" }, calls: { type: "null" } },
    };
  }
  const calls = tools.map((tool) => ({
    type: "object",
    additionalProperties: false,
    required: ["name", "arguments"],
    properties: {
      name: { type: "string", enum: [tool.name] },
      arguments: strict(tool.parameters) ?? { type: "string" }, // the string fallback: JSON inside
    },
  }));
  return {
    type: "object",
    additionalProperties: false,
    required: ["kind", "text", "calls"],
    properties: {
      kind: kind(["text", "tool_calls"]),
      text: { type: ["string", "null"] },
      calls: { type: ["array", "null"], items: { anyOf: calls } },
    },
  };
}

const INSTRUCTIONS = `You are the model behind an agboss agent. You have NO tools of your own: do not run commands, read files or browse.
Reply ONLY with one JSON object: {"kind":"text","text":"..."} to answer in text, or {"kind":"tool_calls","calls":[{"name":"<tool>","arguments":{...}}]} to call tools.
If the system text asks you to reply with a JSON object, put that JSON, as a string, in "text" with "kind":"text".
Call at most one tool whose name starts with "answer-", and never together with other tools.`;

function messageXml(message: ModelProviderRequest["messages"][number]): string {
  const text = escapeText(message.text);
  switch (message.role) {
    case ModelProviderMessageRole.System:
      return `<system>${text}</system>`;
    case ModelProviderMessageRole.User:
      return `<user>${text}</user>`;
    case ModelProviderMessageRole.Tool:
      return `<tool-result id="${escapeAttr(message.toolCallId ?? "")}">${text}</tool-result>`;
    case ModelProviderMessageRole.Assistant: {
      const calls = (message.toolCalls ?? []).map(
        (call) =>
          `<assistant-tool-call id="${escapeAttr(call.id)}" name="${escapeAttr(call.name)}">${escapeText(JSON.stringify(call.arguments))}</assistant-tool-call>`,
      );
      return [message.text === "" ? "" : `<assistant>${text}</assistant>`, ...calls].filter(Boolean).join("\n");
    }
  }
}

/** The whole history, serialised again on every call; `instructions` may go in a system-prompt flag. */
export function buildPrompt(
  request: ModelProviderRequest,
  schema: Json,
  inlineSchema: boolean,
): { readonly instructions: string; readonly body: string } {
  const instructions = inlineSchema
    ? `${INSTRUCTIONS}\n<schema>${JSON.stringify(schema)}</schema>\nOutput the JSON object only, no prose, no code fence.`
    : INSTRUCTIONS;
  const tools = request.tools.map(
    (tool) =>
      `<tool name="${escapeAttr(tool.name)}">${escapeText(tool.description)}\n${escapeText(JSON.stringify(tool.parameters))}</tool>`,
  );
  const body = [`<tools>\n${tools.join("\n")}\n</tools>`, "<conversation>", ...request.messages.map(messageXml), "</conversation>"];
  return { instructions, body: body.join("\n") };
}

/** A reply as text may come in a code fence or with prose around it: take the outermost braces. */
function parseJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new CliInvalidOutputError("no JSON object in the reply", raw);
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new CliInvalidOutputError("the reply is not valid JSON", raw);
  }
}

function argumentsOf(value: unknown, tool: Tool, raw: string): Json {
  const parsed: unknown = typeof value === "string" ? parseJson(value) : value;
  if (!isJson(parsed)) throw new CliInvalidOutputError(`arguments of ${tool.name} are not an object`, raw);
  return typeof value === "string" ? parsed : (dropNulls(parsed, tool.parameters) as Json);
}

/** The CLI's reply (the JSON text, or the object a schema flag returned) as the call's response, minus usage. */
export function readReply(
  raw: unknown,
  tools: readonly Tool[],
): Pick<ModelProviderResponse, "text" | "toolCalls"> {
  const shown = typeof raw === "string" ? raw : JSON.stringify(raw);
  const reply = parseJson(raw);
  if (!isJson(reply)) throw new CliInvalidOutputError("the reply is not an object", shown);
  if (reply["kind"] === "text" && typeof reply["text"] === "string") return { text: reply["text"] };
  const calls = reply["calls"];
  if (reply["kind"] !== "tool_calls" || !Array.isArray(calls) || calls.length === 0) {
    throw new CliInvalidOutputError("the reply is neither text nor tool calls", shown);
  }
  const salt = randomUUID().slice(0, 8);
  const toolCalls = calls.map((call: unknown, index) => {
    const tool = isJson(call) ? tools.find((candidate) => candidate.name === call["name"]) : undefined;
    if (!isJson(call) || tool === undefined) throw new CliInvalidOutputError("a call names an unknown tool", shown);
    return { id: `call_${salt}_${String(index)}`, name: tool.name, arguments: argumentsOf(call["arguments"], tool, shown) };
  });
  return { text: "", toolCalls };
}
