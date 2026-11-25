import { Mesh, MeshInboundMode, defineEnv, secret } from "@agboss/core";
import { minutes } from "@agboss/core/units";

const meshEnv = defineEnv({
  /** The gateway's Ed25519 private key (PKCS #8 PEM): it signs the envelopes it sends. */
  signingKey: secret("MESH_SIGNING_KEY"),
  /** Billing's public key (SPKI PEM): it verifies the run reports billing signs. */
  billingKey: secret("BILLING_VERIFY_KEY"),
});

/** The gateway's mesh: it signs what it sends and trusts billing's signed run reports. It serves no mesh endpoint. */
@Mesh({
  name: "triage-mesh",
  signingKey: meshEnv.signingKey,
  inboundMode: MeshInboundMode.AllowExternal,
  deduplicationTtl: minutes(30),
  maxHops: 3,
  peers: [{ application: "billing-application", verifyKeys: [meshEnv.billingKey] }],
})
export class TriageMesh {}
