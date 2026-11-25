/**
 * job-scout's environment contract (#261): declared fields only — the values are in each
 * `<name>.environment.ts` here. Declared once: `@Application({ environment: AppEnvironment })`;
 * `GreenhouseBoards` reads it as `applicationContext.environment` (`deps: [ApplicationContext]`). The model
 * providers' keys and base URL and the storage's file and PII key are not here: each reads its own
 * reference (`secret(…)`, `env(…)`, `defineEnv`) when the application starts.
 */
export class AppEnvironment {
  /** The Greenhouse job-board API. */
  greenhouseApiUrl!: string;
}
