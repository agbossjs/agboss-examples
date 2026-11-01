import { Integer, Text } from "@agboss/core/dto";

/** A purchase a team asks for: from whom, what, for how much. */
export class PurchaseRequestDto {
  @Text({ prompt: "the supplier's name" })
  supplier!: string;

  @Text({ prompt: "what is bought, in one line" })
  itemDescription!: string;

  @Integer({ prompt: "the price asked, in whole US dollars", min: 1 })
  amountUsd!: number;

  @Text({ prompt: "the supplier's contract terms, as the team summarised them" })
  contractTerms!: string;

  @Text({ prompt: "what is known of the supplier: vetting, sanctions checks, where it is based" })
  supplierProfile!: string;

  @Text({ prompt: "the quotes gathered for the same item, with their date" })
  marketQuotes!: string;

  @Text({ prompt: "the budget line the team would charge, and what is left on it" })
  budgetLine!: string;
}
