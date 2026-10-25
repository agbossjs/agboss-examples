import { Text } from "agboss/dto";

export class ItineraryBriefDto {
  @Text({ prompt: "Concise executive itinerary brief" })
  brief!: string;
}
