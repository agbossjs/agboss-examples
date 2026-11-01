import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const read = (path: string): string => readFileSync(join(root, path), "utf8");
const prose = (text: string): string => text.replaceAll(/^> ?/gmu, "").replaceAll(/\s+/gu, " ");
const SUPPORTED = { stripe: "Stripe", adyen: "Adyen", paypal: "PayPal", "checkout-com": "Checkout.com", cardcom: "CardCom" } as const;
const TEN = ["Stripe", "Adyen", "PayPal", "Braintree", "Checkout.com", "Square", "Tranzila", "CardCom", "Grow", "PayPlus"];

describe("README: the ten gateways", () => {
  const readme = read("README.md");
  it("ten gateways, each with a verdict, a reason, a docs link and a quote, read 2026-11-01", () => {
    expect(readme).toContain("Read on **2026-11-01**");
    for (const gateway of TEN) {
      const row = readme.split("\n").find((line) => line.startsWith(`| **${gateway}**`)) ?? "";
      expect(row, gateway).toMatch(/\| \*\*(Supported(, for [^*]+)?|Not supported)\*\* \|/u);
      expect(row, gateway).toMatch(/\]\(https:\/\/[^)]+\)/u);
      expect(row, gateway).toMatch(/"[^"]{10,}"/u);
    }
  });

  it("each supported row links its folder; the unsupported have none", () => {
    for (const [slug, gateway] of Object.entries(SUPPORTED))
      expect(readme.split("\n").find((line) => line.startsWith(`| **${gateway}**`))).toContain(`(./src/gateways/${slug}/)`);
    for (const gateway of ["Braintree", "Square", "Tranzila", "Grow", "PayPlus"])
      expect(readme.split("\n").find((line) => line.startsWith(`| **${gateway}**`))).toMatch(/\| none \|$/u);
  });

  it("carries the notice and links the full example and the Wiki", () => {
    expect(prose(readme)).toContain("**Independent example, not affiliated.** Every gateway on this page is named only to identify its public API.");
    expect(readme).toContain("(../11-safe-payments/)");
    for (const page of ["Payments", "Payment-gateways", "Payment-scenarios"]) expect(readme).toContain(`https://github.com/agbossjs/agboss/wiki/${page})`);
  });
});

describe("each gateway's README", () => {
  for (const [slug, gateway] of Object.entries(SUPPORTED))
    it(`${slug}: the notice with the date and the docs link, the full example, the Wiki, "may change"`, () => {
      const text = prose(read(`src/gateways/${slug}/README.md`));
      expect(text).toMatch(new RegExp(`\\*\\*Independent example, not affiliated\\.\\*\\* ${gateway.replace(".", "\\.")} is named only to identify its public API\\. AGBoss is not affiliated with, endorsed by or sponsored by ${gateway.replace(".", "\\.")}; the name is its owner's trademark\\. This example follows ${gateway.replace(".", "\\.")}'s public documentation as read on 2026-11-01 \\(https://`, "u"));
      expect(text).toContain("check the official documentation before relying on it");
      expect(text).toContain("(../../../../11-safe-payments/)");
      expect(text).toContain("https://github.com/agbossjs/agboss/wiki/Payments");
      expect(text).toContain("The SDK and the API may change");
    });
});
