import { Injectable, defineEnv, secret, type InferEnv } from "@agboss/core";

export interface BillingApiKeyGrant {
  readonly clientId: string;
  readonly tenantId: string;
  readonly canAnswerPauses: boolean;
}

/** The API keys billing knows, secrets read once when the application starts (never written in the code). */
const billingKeysEnv = defineEnv({
  acme: secret("BILLING_API_KEY"),
  readOnly: secret("BILLING_READONLY_API_KEY"),
});

/** The host's own key store (a database, a KMS, …): the example's holds two keys of the tenant acme. */
@Injectable({ deps: [billingKeysEnv] })
export class BillingApiKeyDirectory {
  constructor(private readonly keys: InferEnv<typeof billingKeysEnv>) {}

  grantOf(apiKey: string): Promise<BillingApiKeyGrant | undefined> {
    if (apiKey === this.keys.acme.reveal()) {
      return Promise.resolve({
        clientId: "triage-gateway-acme",
        tenantId: "acme",
        canAnswerPauses: true,
      });
    }
    if (apiKey === this.keys.readOnly.reveal()) {
      return Promise.resolve({
        clientId: "triage-gateway-readonly",
        tenantId: "acme",
        canAnswerPauses: false,
      });
    }
    return Promise.resolve(undefined);
  }
}
