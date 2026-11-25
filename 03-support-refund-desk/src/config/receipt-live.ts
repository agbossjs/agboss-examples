/**
 * `npm run demo:files:live` sets RECEIPT_LIVE: the application's `modelProvider` is then the real OpenRouter
 * (the receipt readers' and their redaction model's names are `google/…`); otherwise it is the offline one,
 * so `check`, the tests and `npm run demo` never reach the network.
 */
export const RECEIPT_LIVE: boolean = process.env["RECEIPT_LIVE"] === "1";
