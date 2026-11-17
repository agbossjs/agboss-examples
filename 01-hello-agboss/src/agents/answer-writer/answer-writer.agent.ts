import { Agent } from "@agboss/core";

/**
 * Answers in plain text: no `output` DTO, so its answer streams to `onStream` as the model writes it
 * (an agent with an output DTO answers through a tool call and streams no text, #1004).
 */
@Agent({
  name: "answer-writer-agent",
  description: "Writes the support reply as plain text, streamed to the chat widget",
  promptUrls: ["./answer-writer.prompt.md"],
  model: "openai/gpt-4o-mini",
  maxTokens: 400,
})
export class AnswerWriterAgent {}
