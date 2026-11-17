import { Text } from "@agboss/core/dto";

/** `open_page` of the example's own server: which page. */
export class OpenPageArgumentsDto {
  @Text({ prompt: "the page's full URL" })
  url!: string;
}

/** `open_page`: the page as the server read it. */
export class OpenedPageDto {
  @Text({ prompt: "the page's title" })
  title!: string;

  @Text({ prompt: "the page's visible text" })
  text!: string;
}
