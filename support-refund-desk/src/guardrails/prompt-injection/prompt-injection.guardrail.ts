import {
  DecidedBy,
  GuardrailVerdict,
  InputGuardrail,
  type GuardrailHandler,
  type GuardrailRefusal,
} from "agboss";
import { SupportExecutionContext } from "../../dto/support-execution-context.dto.js";
import { InjectionDetectorService } from "../../services/injection-detector.service.js";

@InputGuardrail({
  name: "prompt-injection-guardrail",
  description: "Deterministically blocks prompt injection and policy-override attempts before any model call.",
  decidedBy: DecidedBy.Code,
  deps: [SupportExecutionContext, InjectionDetectorService],
})
export class PromptInjectionGuardrail implements GuardrailHandler, GuardrailRefusal {
  constructor(
    private readonly supportExecutionContext: SupportExecutionContext,
    private readonly injectionDetectorService: InjectionDetectorService,
  ) {}

  check(text: string): GuardrailVerdict {
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
