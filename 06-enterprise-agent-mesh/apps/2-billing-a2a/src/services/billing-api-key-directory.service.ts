import { Injectable } from "agboss";

export interface BillingApiKeyGrant {
  readonly clientId: string;
  readonly tenantId: string;
  readonly canAnswerPauses: boolean;
}

@Injectable()
export class BillingApiKeyDirectory {
  grantOf(apiKey: string): Promise<BillingApiKeyGrant | undefined> {
    if (apiKey === "key-acme") {
      return Promise.resolve({
        clientId: "triage-gateway-acme",
        tenantId: "acme",
        canAnswerPauses: true,
      });
    }
    if (apiKey === "key-readonly") {
      return Promise.resolve({
        clientId: "triage-gateway-readonly",
        tenantId: "acme",
        canAnswerPauses: false,
      });
    }
    return Promise.resolve(undefined);
  }
}
