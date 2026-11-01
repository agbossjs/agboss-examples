import { Agent } from "@agboss/core";
import { PriceBenchmarkDto } from "../../dto/price-benchmark.dto.js";
import { PurchaseRequestDto } from "../../dto/purchase-request.dto.js";
import { CHAT_MODEL } from "../../model-providers/models.js";

/** One of the four parallel reviews of a purchase request. */
@Agent({
  name: "price-benchmark-agent",
  description: "Compares the price with the market",
  promptUrls: ["./price-benchmark.prompt.md"],
  model: CHAT_MODEL,
  input: {
    request: PurchaseRequestDto,
  },
  output: PriceBenchmarkDto,
})
export class PriceBenchmarkAgent {}
