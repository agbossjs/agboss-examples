import { Workflow, onStart, Ttl } from "@agboss/core";
import { AnswerWriterAgent } from "../../agents/answer-writer/answer-writer.agent.js";
import { StreamingAnswerWorkflowFinish } from "./streaming-answer.workflow-finish.js";
import { StreamingAnswerWorkflowStart } from "./streaming-answer.workflow-start.js";

@Workflow({
  name: "streaming-answer-workflow",
  version: "0.1.1",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(StreamingAnswerWorkflowStart)
      .toAgent(AnswerWriterAgent)
      .toFinish(StreamingAnswerWorkflowFinish),
  ],
})
export class StreamingAnswerWorkflow {}
