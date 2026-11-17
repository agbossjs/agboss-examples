import { Text } from "@agboss/core/dto";

export class ContactRequestDto {
  @Text({
    prompt: "the request's own reference, e.g. callback-1042: the same reference is submitted once, whatever is retried",
    maxLength: 80,
    pattern: /^[a-z0-9][a-z0-9-]*$/u,
  })
  reference!: string;

  @Text({ prompt: "the person's name", maxLength: 120 })
  name!: string;

  @Text({ prompt: "the person's email", maxLength: 200 })
  email!: string;

  @Text({ prompt: "the message to the support desk", maxLength: 2000 })
  message!: string;
}

export class ContactReceiptDto {
  @Text({ prompt: "the support desk's ticket id, e.g. T-1" })
  ticketId!: string;
}
