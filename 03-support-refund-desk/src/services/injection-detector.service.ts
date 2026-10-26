import { Injectable } from "@agboss/core";

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
