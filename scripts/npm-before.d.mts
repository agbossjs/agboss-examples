/** The types of `scripts/npm-before.mjs` (agbossjs/agboss#523) for the examples' TypeScript tests. */
export declare const MINIMUM_RELEASE_AGE_DAYS: number;
export declare const NPM_BEFORE_VARIABLE: string;
export declare class NpmBeforeError extends Error {}
export declare function npmBeforeOf(
  env?: Readonly<Record<string, string | undefined>>,
  now?: Date,
): string;
export declare function rangeInstallArguments(
  rest?: readonly string[],
  env?: Readonly<Record<string, string | undefined>>,
  now?: Date,
): string[];
