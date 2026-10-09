// eslint-disable-next-line no-restricted-imports
import { environmentToken } from "graphcompose/core";

export interface AppEnvironment {
  readonly greenhouseApiUrl: string;
}

export const ENV = environmentToken<AppEnvironment>();

export const environment: AppEnvironment = {
  greenhouseApiUrl: "https://boards-api.greenhouse.io",
};
