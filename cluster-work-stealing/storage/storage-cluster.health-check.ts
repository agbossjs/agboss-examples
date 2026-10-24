import {
  HealthCheck,
  HealthCheckResult,
  Injectable,
  type HealthCheckHandler,
} from "agboss";
import { seconds } from "agboss/units";

@Injectable()
export class StorageBackendProbeService {
  ping(): Promise<"healthy" | "degraded" | "unhealthy"> {
    return Promise.resolve("healthy");
  }
}

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
