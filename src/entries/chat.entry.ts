import { ChatMessage } from "graphcompose/dto";
import { Entry } from "graphcompose/graph";

/** Where a turn starts: the job seeker's message. */
@Entry({
  name: "chat-message",
  description: "A message from the job seeker",
  input: ChatMessage,
})
export class ChatEntry {}
