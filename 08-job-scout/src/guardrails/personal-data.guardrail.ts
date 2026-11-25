import { OutputGuardrail, inline } from "@agboss/core";
import { DecisionsModelProvider } from "../model-providers/openrouter.model-provider.js";

/** Every agent's answer is checked before it leaves (#120): personal data of a real person is withheld. */
@OutputGuardrail({
  name: "personal-data-guardrail",
  description: "Withholds answers that reveal personal data",
  prompt: inline("Does this answer reveal personal data of a real person (phone, email, address, ID)?"),
  modelProvider: DecisionsModelProvider, // a decision model: Jev
  threshold: 0.7,
  refusal: "The answer contained personal data and was withheld.",
})
export class PersonalDataGuardrail {}
