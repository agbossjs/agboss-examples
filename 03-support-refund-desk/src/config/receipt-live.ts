/**
 * `npm run demo:files:live` sets RECEIPT_LIVE: the receipt readers' and their redaction model's name
 * (`google/…`) is then served by the real OpenRouter provider; otherwise by the offline one, so `check`,
 * the tests and `npm run demo` never reach the network (the OpenRouter provider reads its models' catalog
 * at start).
 */
export const RECEIPT_LIVE: boolean = process.env["RECEIPT_LIVE"] === "1";
