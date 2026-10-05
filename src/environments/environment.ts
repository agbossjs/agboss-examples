export interface AppEnvironment {
  readonly greenhouseApiUrl: string;
}

export const environment: AppEnvironment = {
  greenhouseApiUrl: "https://boards-api.greenhouse.io",
};
