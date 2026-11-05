export interface FillSample {
  readonly t: number;
  readonly queued: number;
  readonly podBusy?: Readonly<Record<string, number>>;
  readonly podSlots?: Readonly<Record<string, number>>;
  readonly podHeld?: Readonly<Record<string, number>>;
}
export interface SlotFill {
  readonly samples: number;
  readonly podSamples: number;
  readonly podFill: number;
  readonly clusterFill: number;
  readonly longestIdle: Readonly<Record<string, number>>;
  readonly idlest: string;
  readonly idleFor: number;
}
export declare function slotFillOf(
  samples: readonly FillSample[],
  window: { readonly from: number; readonly to: number; readonly gone?: readonly { readonly pod: string; readonly from: number }[] },
): SlotFill;
