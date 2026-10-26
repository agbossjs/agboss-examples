import { Injectable } from "@agboss/core";

@Injectable()
export class StorageBackendProbeService {
  ping(): Promise<"healthy" | "degraded" | "unhealthy"> {
    return Promise.resolve("healthy");
  }
}
