export declare const WORKER_POD_PREFIX: string;
export declare function workersSettledAt(
  pods: readonly { readonly name: string; readonly deleting: boolean }[],
  count: number,
): boolean;
