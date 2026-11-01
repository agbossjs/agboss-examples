import type { CreditApplicationDto } from "../../src/dto/credit-application.dto.js";

/** An application that meets every threshold: the analyst writes its memo. */
export const SOUND_APPLICATION: CreditApplicationDto = {
  applicantName: "Dana Levi",
  amountUsd: 40_000,
  creditScore: 720,
  debtToIncome: 0.28,
  purpose: "Renovating the kitchen of the flat I own",
};

/** An application that fails a threshold (the credit score): declined before any review. */
export const WEAK_APPLICATION: CreditApplicationDto = {
  applicantName: "Omer Katz",
  amountUsd: 15_000,
  creditScore: 540,
  debtToIncome: 0.3,
  purpose: "Consolidating card debt",
};

/** `SOUND_APPLICATION` with some fields changed. */
export const applicationWith = (changes: Partial<CreditApplicationDto>): CreditApplicationDto =>
  Object.assign({}, SOUND_APPLICATION, changes);
