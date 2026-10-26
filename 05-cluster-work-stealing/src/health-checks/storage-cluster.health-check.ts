import {
  HealthCheck,
  HealthCheckResult,
  type HealthCheckHandler,
} from "@agboss/core";
import { seconds } from "@agboss/core/units";
import { StorageBackendProbeService } from "../services/storage-backend-probe.service.js";

@HealthCheck({
  name: "storage-cluster-health-check",
  timeout: seconds(2),
  deps: [StorageBackendProbeService],
})
export class StorageClusterHealthCheck implements HealthCheckHandler {
  constructor(
    private readonly storageBackendProbeService: StorageBackendProbeService,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const state = await this.storageBackendProbeService.ping();
    if (state === "healthy") {
      return HealthCheckResult.healthy();
    }
    if (state === "degraded") {
      return HealthCheckResult.degraded({
        reason: "SQLite WAL checkpoint latency above threshold",
      });
    }
    return HealthCheckResult.unhealthy({
      reason: "Shared cluster storage volume unreachable",
    });
  }
}
