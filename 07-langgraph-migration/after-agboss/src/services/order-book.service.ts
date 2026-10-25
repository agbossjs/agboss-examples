import { Injectable } from "agboss";

@Injectable()
export class OrderBookService {
  factsOf(orderId: string): Promise<string> {
    return Promise.resolve(
      `order ${orderId}: delivered four days late; shipping fee 1500 cents ($15.00), eligible for a 1500 cents refund`,
    );
  }
}
