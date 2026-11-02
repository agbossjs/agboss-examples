#!/bin/sh
# Validates every manifest under deploy/ (agbossjs/agboss#486) with kubeconform, run from its
# official image (no install, no cluster): Kubernetes 1.31 schemas, the KEDA and Prometheus Operator
# CRDs from the datree CRDs catalog, strict. The adapter values and the Collector configs are parsed
# as YAML, the ECS policy as JSON. Needs Docker and the network (the schemas): not part of `check`.
set -eu
cd "$(dirname "$0")/.."
docker run --rm --cpus 1 --memory 256m -v "$PWD/deploy:/deploy:ro" ghcr.io/yannh/kubeconform:v0.7.0 \
  -strict -summary -kubernetes-version 1.31.0 \
  -schema-location default \
  -schema-location 'https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json' \
  /deploy/worker-deployment.yaml /deploy/keda-scaledobject.yaml /deploy/hpa-prometheus-adapter.yaml
node --input-type=module -e '
import { readFileSync } from "node:fs";
import { parseAllDocuments } from "yaml";
for (const file of process.argv.slice(1)) {
  for (const doc of parseAllDocuments(readFileSync(file, "utf8")))
    if (doc.errors.length > 0) throw new Error(`${file}: ${doc.errors[0].message}`);
  console.log(`yaml ok: ${file}`);
}
JSON.parse(readFileSync("deploy/collector/ecs-scaling-policy.json", "utf8"));
console.log("json ok: deploy/collector/ecs-scaling-policy.json");
' deploy/prometheus-adapter-values.yaml deploy/collector/ecs-cloudwatch.yaml deploy/collector/cloudrun-gmp.yaml deploy/collector/containerapps-keda.yaml
