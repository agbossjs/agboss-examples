/**
 * The environment a vendor CLI runs with: an allowlist, never a copy of ours. No API key and no
 * agboss secret (OPENROUTER_API_KEY, PII_PSEUDONYM_KEY, ...) reaches the child; the CLI finds its
 * own saved login the way it always does, through HOME.
 */
const COMMON_KEYS: ReadonlySet<string> = new Set([
  "PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "TMPDIR", "TERM",
  "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "no_proxy",
  "SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS",
  "SystemRoot", "ComSpec", "PATHEXT", "APPDATA", "LOCALAPPDATA", "USERPROFILE",
]);

/** `extraKeys`: the CLI's own config-directory names, passed through (their values are never read). */
export function childEnv(
  source: NodeJS.ProcessEnv,
  extraKeys: readonly string[] = [],
): Record<string, string> {
  const allowed = new Set([...COMMON_KEYS, ...extraKeys]);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && (allowed.has(key) || key.startsWith("LC_"))) env[key] = value;
  }
  return env;
}
