import { Injectable, defineEnv, env, type InferEnv } from "@agboss/core";

/**
 * Where the gateway is — here its local stub — read once when the application starts. The default is a port
 * nothing listens on: no real gateway is ever called. Your project: your gateway's own address and keys.
 */
export const gatewayEnv = defineEnv({
  /** The gateway stub's base URL (`http://127.0.0.1:<port>`; PayPal's: `https://…`), set by whoever starts it. */
  url: env("GATEWAY_STUB_URL", { default: "http://127.0.0.1:9" }),
  /** PayPal's stub only: the PEM of its test-time certificate (the SDK's TLS agent trusts it). */
  ca: env.optional("GATEWAY_STUB_CA"),
});

@Injectable({ deps: [gatewayEnv] })
export class GatewayStubService {
  constructor(private readonly stub: InferEnv<typeof gatewayEnv>) {}

  /** The stub's base URL, `http://127.0.0.1:<port>`. */
  baseUrl(): string {
    return this.stub.url;
  }

  /** The stub's TLS certificate (PayPal's stub only), PEM. */
  certificate(): string {
    return this.stub.ca ?? "";
  }
}
