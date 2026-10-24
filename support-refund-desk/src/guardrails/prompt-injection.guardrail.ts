import {
  DecidedBy,
  GuardrailVerdict,
  Injectable,
  InputGuardrail,
  type GuardrailHandler,
  type GuardrailRefusal,
} from "agboss";
import { SupportExecutionContext } from "../workflows/dtos.js";

const INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(?:all\s+)?previous\s+instructions/iu,
  /system\s+override/iu,
  /bypass\s+refund\s+policy/iu,
  /grant\s+admin\s+refund/iu,
];

@Injectable()
export class InjectionDetectorService {
  isInjectionAttempt(text: string): boolean {
    return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
  }
}

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
