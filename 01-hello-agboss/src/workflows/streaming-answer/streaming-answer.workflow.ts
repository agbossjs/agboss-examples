import { Workflow, start } from "@agboss/core";
import { WorkflowStartTextDto } from "@agboss/core/dto";
import { AnswerWriterAgent } from "../../agents/answer-writer/answer-writer.agent.js";
import { StreamingAnswerWorkflowFinish } from "./streaming-answer.workflow-finish.js";
import { StreamingAnswerWorkflowStart } from "./streaming-answer.workflow-start.js";

@Workflow({
  name: "streaming-answer-workflow",
  version: "0.1.0",
  flow: [
    start(StreamingAnswerWorkflowStart)
      .returns(WorkflowStartTextDto)
      .toAgent(AnswerWriterAgent)
      .toFinish(StreamingAnswerWorkflowFinish),
  ],
})
export class StreamingAnswerWorkflow {}
