import { Injectable } from "agboss";

@Injectable()
export class StorageBackendProbeService {
  ping(): Promise<"healthy" | "degraded" | "unhealthy"> {
    return Promise.resolve("healthy");
  }
}
