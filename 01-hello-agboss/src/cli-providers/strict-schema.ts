export type Json = Record<string, unknown>;

export function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const KEPT = ["type", "enum", "const", "description"] as const;

function stringList(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function strictObject(node: Json, out: Json): Json | undefined {
  if (!isJson(node["properties"])) return undefined; // an open object: no fixed shape
  const required = new Set(stringList(node["required"]));
  const properties: Json = {};
  for (const [key, child] of Object.entries(node["properties"])) {
    const strictChild = strict(child);
    if (strictChild === undefined) return undefined;
    properties[key] = required.has(key) ? strictChild : { anyOf: [strictChild, { type: "null" }] };
  }
  return {
    ...out,
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

/**
 * A tool's parameter schema in strict-mode form: only the keywords every vendor's structured output
 * accepts, every property required (an optional one may be null), no extra properties, `oneOf` as
 * `anyOf`. `undefined` when it cannot be made strict (an open object, `{}`, `$ref`, `allOf`,
 * `patternProperties`): the tool then takes its arguments as a JSON string. The model still sees the
 * original schema in the prompt; agboss validates the arguments against it.
 */
export function strict(node: unknown): Json | undefined {
  if (!isJson(node)) return undefined;
  if (["$ref", "allOf", "patternProperties"].some((key) => key in node)) return undefined;
  const out: Json = {};
  for (const key of KEPT) if (key in node) out[key] = node[key];
  const variants = node["anyOf"] ?? node["oneOf"];
  if (Array.isArray(variants)) {
    const mapped = variants.map(strict);
    return mapped.every((item) => item !== undefined) ? { ...out, anyOf: mapped } : undefined;
  }
  const type = node["type"];
  if (type === "object") return strictObject(node, out);
  if (type === "array") {
    const items = strict(node["items"]);
    return items === undefined ? undefined : { ...out, items };
  }
  return type === undefined && !("enum" in node) && !("const" in node) ? undefined : out;
}

function admitsNull(schema: unknown): boolean {
  if (!isJson(schema)) return false;
  const type = schema["type"];
  if (type === "null" || (Array.isArray(type) && type.includes("null"))) return true;
  const variants = schema["anyOf"] ?? schema["oneOf"];
  return Array.isArray(variants) && variants.some(admitsNull);
}

/** The reply of a strict schema, back to the original's shape: a `null` stands in only for an optional property. */
export function dropNulls(value: unknown, schema: unknown): unknown {
  if (!isJson(schema)) return value;
  if (Array.isArray(value)) return value.map((item) => dropNulls(item, schema["items"]));
  if (!isJson(value) || !isJson(schema["properties"])) return value;
  const required = new Set(stringList(schema["required"]));
  const out: Json = {};
  for (const [key, child] of Object.entries(value)) {
    const own = schema["properties"][key];
    if (child === null && !required.has(key) && !admitsNull(own)) continue;
    out[key] = dropNulls(child, own);
  }
  return out;
}
