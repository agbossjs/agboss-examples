import {
  ToolInterceptor,
  type AfterToolCall,
  type ToolCallResultContext,
} from "@agboss/core";

export interface AuditedToolCallEntry {
  readonly toolName: string;
  readonly input: unknown;
  readonly output: unknown;
}

const auditTrail: AuditedToolCallEntry[] = [];

export function getAuditTrail(): readonly AuditedToolCallEntry[] {
  return [...auditTrail];
}

export function resetAuditTrail(): void {
  auditTrail.length = 0;
}

@ToolInterceptor({
  name: "audit-trail-tool-interceptor",
  description: "Records completed tool executions into the compliance audit log.",
})
export class AuditTrailToolInterceptor implements AfterToolCall {
  afterToolCall(call: ToolCallResultContext): unknown {
    auditTrail.push({
      toolName: call.tool.name,
      input: call.input,
      output: call.output,
    });
    return call.output;
  }
}
