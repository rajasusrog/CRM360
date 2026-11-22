export type OutboundMessage = {
  firmId: string;
  channel: "email" | "whatsapp";
  to: string;
  subject?: string;
  body: string;
  relatedType?: string;
  relatedId?: string;
};

export type SendResult = {
  provider: string;
  status: "stubbed" | "sent";
  externalId?: string;
};

/** Delivery boundary. The default adapter records the message and does not call a provider. */
export interface MessageAdapter {
  send(message: OutboundMessage): Promise<SendResult>;
}

export class StubMessageAdapter implements MessageAdapter {
  async send(): Promise<SendResult> {
    return { provider: "stub", status: "stubbed", externalId: crypto.randomUUID() };
  }
}

export function getMessageAdapter(): MessageAdapter {
  return new StubMessageAdapter();
}
