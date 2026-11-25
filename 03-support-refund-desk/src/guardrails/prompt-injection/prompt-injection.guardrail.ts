import { GuardrailVerdict, type GuardrailContent, InputGuardrail, type GuardrailRefusal } from "@agboss/core";
import { SupportExecutionContext } from "../../contexts/support-execution.context.js";
import { InjectionDetectorService } from "../../services/injection-detector.service.js";

@InputGuardrail({
  name: "prompt-injection-guardrail",
  description: "Deterministically blocks prompt injection and policy-override attempts before any model call.",
  deps: [SupportExecutionContext, InjectionDetectorService],
})
export class PromptInjectionGuardrail implements GuardrailRefusal {
  constructor(
    private readonly supportExecutionContext: SupportExecutionContext,
    private readonly injectionDetectorService: InjectionDetectorService,
  ) {}

  check({ text }: GuardrailContent): GuardrailVerdict {
    return this.injectionDetectorService.isInjectionAttempt(text)
      ? GuardrailVerdict.blocked()
      : GuardrailVerdict.passed();
  }

  refusal(): string {
    return this.supportExecutionContext.locale === "es"
      ? "Solicitud bloqueada por la política de seguridad contra inyección de instrucciones."
      : "Request blocked by security guardrail: instruction override attempts are not permitted.";
  }
}
