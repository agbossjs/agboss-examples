import { Mesh, MeshInboundMode, defineEnv, secret } from "@agboss/core";
import { minutes } from "@agboss/core/units";

const meshEnv = defineEnv({
  /** This application's Ed25519 private key (PKCS #8 PEM): it signs the run reports it answers with. */
  signingKey: secret("MESH_SIGNING_KEY"),
  /** The triage gateway's public key (SPKI PEM): a call is trusted only with its signature. */
  triageKey: secret("TRIAGE_VERIFY_KEY"),
});

/** Catalog's mesh: three hops at most, the triage gateway is its one peer; a request that is no mesh call is let in to the authenticator. */
@Mesh({
  name: "catalog-mesh",
  signingKey: meshEnv.signingKey,
  inboundMode: MeshInboundMode.AllowExternal,
  deduplicationTtl: minutes(30),
  maxHops: 3,
  peers: [{ application: "triage-gateway-application", verifyKeys: [meshEnv.triageKey] }],
})
export class CatalogMesh {}
