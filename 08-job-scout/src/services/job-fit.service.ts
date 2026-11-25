import { DecisionModel, Decision, Injectable } from "@agboss/core";
import { DecisionsModelProvider } from "../model-providers/openrouter.model-provider.js";
import { FIT_QUESTION, JOB_TEXT_CHARS, type JobText } from "../helpers/fit.helper.js";

/** P(the job fits what the candidate wants), undefined when the judge failed; and what it cost. */
export interface JobFit {
  readonly fit: number | undefined;
  readonly costUsd: number;
}

/** Rates how well a job fits what the candidate wants. */
export interface FitRater {
  rate(profile: string, job: JobText): Promise<JobFit>;
}

/** The decision model that judges a fit: Jev, on OpenRouter's Decisions API. */
const FIT_MODEL = "typesafe/jev-1.13";

/**
 * Jev as the fit judge: one cheap decision per job through the injected `DecisionModel`. The framework
 * records each call's spend under the step's caller and checks the budgets before it, so `costUsd` is 0 here.
 */
@Injectable({ deps: [DecisionModel] })
export class JobFitJudge implements FitRater {
  constructor(private readonly decisionModel: DecisionModel) {}

  async rate(profile: string, job: JobText): Promise<JobFit> {
    try {
      const answers = await this.decisionModel.decide(
        {
          state: {
            candidate: profile,
            job: `${job.title} — ${job.company}, ${job.location}`,
            department: job.department,
            description: job.text.slice(0, JOB_TEXT_CHARS),
          },
          questions: { fits: Decision.boolean(FIT_QUESTION) },
        },
        { model: FIT_MODEL, modelProvider: DecisionsModelProvider },
      );
      return { fit: answers.fits.probability, costUsd: 0 };
    } catch {
      return { fit: undefined, costUsd: 0 };
    }
  }
}
