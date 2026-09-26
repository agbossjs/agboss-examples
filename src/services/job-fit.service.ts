import { Injectable, ROUTER_FACTORY, type Router } from "graphcompose";
import { routerFitJudge, type FitJudge } from "../helpers/fit.helper.js";

/** Rates how well a job fits what the candidate wants. */
export interface FitRater {
  rate: FitJudge;
}

/** Jev as the fit judge, from the core's router factory. */
@Injectable({ deps: [ROUTER_FACTORY] })
export class JobFitJudge implements FitRater {
  readonly rate: FitJudge;

  constructor(routers: (name: string) => Router) {
    this.rate = routerFitJudge(routers("job-fit"));
  }
}
