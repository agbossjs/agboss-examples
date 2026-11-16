`live-text.jsonl`, `live-tool-call.jsonl` and `live-error.jsonl` were RECORDED from a real `claude -p` run
(Claude Code 2.1.325, logged in with the maintainer's own plan, model `haiku`, 2026-11-16, agbossjs/agboss#963),
driving the provider itself, so the flags, the prompt and the temp directory are the provider's own. Raw
recordings stay outside the repository; `scripts/scrub-fixture.ts` replaces ids, home and temp paths, emails,
signatures, the plugin list, cost and rate-limit fields, and `tests/cli-providers/fixtures-are-scrubbed.test.ts`
fails if any fixture holds an email, a home path, or a UUID that is not a placeholder. Re-record with
`npx tsx scripts/record-cli-fixtures.ts claude` (a live run is the maintainer's call: account risk).

What a real run showed (all handled by the provider):
- `init.tools` is exactly `["StructuredOutput"]` with `--tools ""` and `--json-schema`.
- The model first answers in a plain text block, the CLI then injects a synthetic user turn
  (`[structured-output-enforce]`) and the model calls `StructuredOutput`; `result.structured_output` is the reply.
- Extra events the provider ignores: `ui_invalidate`, `thinking_tokens`, `rate_limit_event`, `user`.
- An unknown model gives `result.is_error: true` with `api_error_status: 404` and the text on stdout, a short
  stderr line `[claude-code:unrecognized_model]`, and no `structured_output`.

The remaining hand-written files (`tool-call`, `init-*`, `lookalike-*`, `native-tool`, `no-init`) are fail-closed
cases a real run cannot be made to produce (a tool of the CLI's own would have to run).
