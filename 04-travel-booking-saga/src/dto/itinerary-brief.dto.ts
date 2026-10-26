import { Text } from "@agboss/core/dto";

export class ItineraryBriefDto {
  @Text({ prompt: "Concise executive itinerary brief" })
  brief!: string;
}
