// `npm run cluster:down` (agbossjs/agboss#487): deletes the kind cluster and everything in it.
import { CLUSTER, log, run } from "./kube.mjs";

log(`kind delete cluster --name ${CLUSTER}`);
run("kind", ["delete", "cluster", "--name", CLUSTER]);
