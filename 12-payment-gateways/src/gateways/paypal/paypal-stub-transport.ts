// Independent example, not affiliated (see paypal.gateway-payments.ts).
import { Agent, type AgentOptions, type RequestOptions } from "node:https";
import type { Duplex } from "node:stream";
import { connect, type ConnectionOptions } from "node:tls";

/**
 * The SDK has no base URL option (production or sandbox only): its `httpClientOptions.httpsAgent`
 * opens every TLS connection to the stub on 127.0.0.1, which serves a certificate for the sandbox's
 * host made at test time. Nothing leaves the machine. Not part of the wiring you copy: in production
 * the SDK's own agent reaches PayPal.
 */
export class StubTlsAgent extends Agent {
  constructor(private readonly port: number, private readonly ca: string, options: AgentOptions = {}) {
    super({ ...options, keepAlive: false });
  }

  override createConnection(options: RequestOptions): Duplex {
    return connect({ ...(options as ConnectionOptions), host: "127.0.0.1", port: this.port, servername: "api-m.sandbox.paypal.com", ca: this.ca });
  }
}

