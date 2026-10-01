import { TextAnswer } from "graphcompose/dto";
import { Conclusion } from "graphcompose/graph";

/** Where a turn ends: the answer sent back to the job seeker. */
@Conclusion({
  name: "answer",
  description: "The answer sent back to the job seeker",
  output: TextAnswer,
})
export class AnswerConclusion {}
