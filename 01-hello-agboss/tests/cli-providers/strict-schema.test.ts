import { describe, expect, it } from "vitest";
import { dropNulls, strict } from "../../src/cli-providers/strict-schema.js";
import { envelopeSchema, readReply } from "../../src/cli-providers/turn.js";

const tool = (parameters: Record<string, unknown>) => ({ name: "t", description: "d", parameters });

describe("strict(): a tool's parameters in strict-mode form", () => {
  it("requires every property, makes optional ones nullable, closes objects, turns oneOf into anyOf", () => {
    const out = strict({
      type: "object",
      title: "T",
      properties: { a: { type: "string", minLength: 2 }, b: { oneOf: [{ type: "number" }, { type: "string" }] } },
      required: ["a"],
    });
    expect(out).toEqual({
      type: "object",
      properties: { a: { type: "string" }, b: { anyOf: [{ anyOf: [{ type: "number" }, { type: "string" }] }, { type: "null" }] } },
      required: ["a", "b"],
      additionalProperties: false,
    });
  });

  it.each([
    ["an open object", { type: "object" }],
    ["{}", {}],
    ["a $ref", { $ref: "#/$defs/x" }],
    ["patternProperties", { type: "object", properties: {}, patternProperties: { "^x": { type: "string" } } }],
  ])("cannot make %s strict: the tool takes a JSON string", (_name, schema) => {
    expect(strict(schema)).toBeUndefined();
    const envelope = envelopeSchema([tool(schema)]) as { properties: { calls: { items: { anyOf: { properties: { arguments: unknown }[] }[] } } } };
    expect(envelope.properties.calls.items.anyOf[0]?.properties).toMatchObject({ arguments: { type: "string" } });
    const reply = readReply({ kind: "tool_calls", text: null, calls: [{ name: "t", arguments: '{"x":1}' }] }, [tool(schema)]);
    expect(reply.toolCalls?.[0]?.arguments).toEqual({ x: 1 });
  });

  it("drops a null only where the original property was optional and not nullable", () => {
    const schema = { type: "object", properties: { a: { type: "string" }, b: { type: "string" }, c: { type: ["string", "null"] } }, required: ["a"] };
    expect(dropNulls({ a: "x", b: null, c: null }, schema)).toEqual({ a: "x", c: null });
  });
});

describe("the per-turn union", () => {
  it("is text only when the call has no tools", () => {
    expect(envelopeSchema([])).toMatchObject({ properties: { kind: { enum: ["text"] }, calls: { type: "null" } } });
  });

  it("reads text, strips a code fence and prose, and rejects anything else", () => {
    expect(readReply('Here:\n```json\n{"kind":"text","text":"hi","calls":null}\n```', [])).toEqual({ text: "hi" });
    expect(() => readReply('{"kind":"tool_calls","text":null,"calls":[{"name":"nope","arguments":{}}]}', [])).toThrow(/unknown tool/u);
    expect(() => readReply("no json at all", [])).toThrow(/cli\.invalid-output/u);
    expect(() => readReply({ kind: "tool_calls", text: null, calls: [] }, [])).toThrow(/neither text nor tool calls/u);
  });
});
