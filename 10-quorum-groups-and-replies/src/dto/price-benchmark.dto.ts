import { Flag, Integer, Text } from "@agboss/core/dto";

/** The price compared with the market. */
export class PriceBenchmarkDto {
  @Text({ prompt: "where the benchmark comes from, e.g. 'three quotes, 2026-10'; empty if none" })
  source!: string;

  @Integer({ prompt: "the market price for the same item, in whole US dollars", min: 0 })
  benchmarkUsd!: number;

  @Flag({ prompt: "whether the price asked is fair against the benchmark" })
  isFairPrice!: boolean;

  @Text({ prompt: "what the check found, one or two sentences" })
  findings!: string;
}
