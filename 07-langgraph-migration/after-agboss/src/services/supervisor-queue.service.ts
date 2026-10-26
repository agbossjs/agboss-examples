import { Injectable } from "@agboss/core";

@Injectable()
export class SupervisorQueueService {
  notify(pauseId: string, text: string): Promise<void> {
    void pauseId;
    void text;
    return Promise.resolve();
  }
}
