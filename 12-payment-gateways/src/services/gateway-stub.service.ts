import { ApplicationContext, Injectable } from "@agboss/core";

/** Where the gateway is — here its local stub — from the environment. Your project: your gateway's own. */
@Injectable({ deps: [ApplicationContext] })
export class GatewayStubService {
  constructor(private readonly applicationContext: ApplicationContext) {}

  /** The stub's base URL, `http://127.0.0.1:<port>`. */
  baseUrl(): string {
    return this.applicationContext.environment.gatewayStubUrl;
  }

  /** The stub's TLS certificate (PayPal's stub only), PEM. */
  certificate(): string {
    return this.applicationContext.environment.gatewayStubCa ?? "";
  }
}
