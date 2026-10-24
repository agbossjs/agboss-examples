# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities privately by email to **security@agboss.dev** — never in a public issue, pull request, or discussion. You may also use GitHub's private vulnerability reporting on [`agbossjs/agboss`](https://github.com/agbossjs/agboss/security/advisories/new).

Please include:
- The affected example or package (`agboss`, `agboss-cli`, or `agboss-examples`) and version/commit;
- What an attacker can do and under which conditions;
- Minimal reproduction steps (using synthetic data only — never send real credentials or personal data).

## Secret & PII Prevention in Examples (Rule R6)

- `.env` and `.env.*` (except `.env.example`) are blocked by `.gitignore`.
- Examples must only use synthetic fixtures (`CUS-0001`, `alice.synthetic@example.test`, fake card tokens, and in-memory/local SQLite ledgers).
- Never commit real API keys (`OPENROUTER_API_KEY`, `LANGFUSE_*`) or unredacted production execution traces.
