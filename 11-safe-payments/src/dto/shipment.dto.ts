import { Text } from "@agboss/core/dto";

export class ShipmentDto {
  @Text({ prompt: "the carrier's tracking number" })
  trackingNumber!: string;
}
