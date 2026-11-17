import { Text } from "@agboss/core/dto";

export class PageRequestDto {
  @Text({ prompt: "the page's full URL, e.g. https://docs.example.com/pricing", maxLength: 2048 })
  url!: string;
}

export class PageTextDto {
  @Text({ prompt: "the page's title" })
  title!: string;

  @Text({ prompt: "the page's visible text" })
  text!: string;
}
