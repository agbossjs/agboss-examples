import { replyWith } from "@agboss/core/testing";
import { BudgetCheckDto } from "../../src/dto/budget-check.dto.js";
import { ComplianceReviewDto } from "../../src/dto/compliance-review.dto.js";
import { LegalReviewDto } from "../../src/dto/legal-review.dto.js";
import { PriceBenchmarkDto } from "../../src/dto/price-benchmark.dto.js";
import type { PurchaseRequestDto } from "../../src/dto/purchase-request.dto.js";

/** The purchase every test asks for. */
export const LAPTOPS = {
  supplier: "Northwind Hardware",
  itemDescription: "12 developer laptops",
  amountUsd: 1_200,
  contractTerms: "Liability capped at the order value (§7.2); 30-day termination (§9.1); no customer data shared.",
  supplierProfile: "Vetted in 2025 under PP-4.1 vendor vetting; no sanctions hits; based in the EU.",
  marketQuotes: "Three quotes for the same 12 laptops, 2026-10: $1,240, $1,250 and $1,260.",
  budgetLine: "OPEX-IT-2026, $10,000 left before this purchase.",
} satisfies PurchaseRequestDto;

/** What the order agent calls the purchase-order tool with: the request's supplier, item and amount. */
export const LAPTOP_ORDER = {
  supplier: LAPTOPS.supplier,
  itemDescription: LAPTOPS.itemDescription,
  amountUsd: LAPTOPS.amountUsd,
};

export const LEGAL_CLEARED = {
  clause: "§7.2 liability cap",
  isCleared: true,
  findings: "Standard terms; liability capped at the order value.",
} satisfies LegalReviewDto;

export const COMPLIANCE_OK = {
  clause: "PP-4.1 vendor vetting",
  isCompliant: true,
  findings: "Vetted supplier, no sanctions hit.",
} satisfies ComplianceReviewDto;

/** The failure injection: a compliance review that cites no clause. */
export const COMPLIANCE_UNCITED = {
  clause: "",
  isCompliant: true,
  findings: "Looks fine to me.",
} satisfies ComplianceReviewDto;

export const PRICE_FAIR = {
  source: "three quotes, 2026-10",
  benchmarkUsd: 1_250,
  isFairPrice: true,
  findings: "Within the market range.",
} satisfies PriceBenchmarkDto;

export const BUDGET_OK = {
  budgetLine: "OPEX-IT-2026",
  remainingUsd: 8_800,
  findings: "The line carries it.",
} satisfies BudgetCheckDto;

export const legal = (value: LegalReviewDto = LEGAL_CLEARED) => replyWith(LegalReviewDto, value);
export const compliance = (value: ComplianceReviewDto = COMPLIANCE_OK) =>
  replyWith(ComplianceReviewDto, value);
export const price = (value: PriceBenchmarkDto = PRICE_FAIR) => replyWith(PriceBenchmarkDto, value);
export const budget = (value: BudgetCheckDto = BUDGET_OK) => replyWith(BudgetCheckDto, value);
