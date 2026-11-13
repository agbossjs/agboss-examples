Written by hand from Anthropic's `--output-format stream-json` documentation, NOT recorded from a live
`claude` run (a live run is the maintainer's call: account risk). Re-record before relying on the shapes.

The `init` event of a real `claude -p --json-schema` run may list the structured-output tool
(`StructuredOutput`, the name in Anthropic's docs) among its `tools`. The provider's tools-off check
tolerates exactly that name and nothing else: any other listed tool kills the run, and an init event
without a `tools` array gives no answer. `init-structured.jsonl` has that shape. Re-record both once a
live run is approved.
