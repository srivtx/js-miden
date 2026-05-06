export interface Message {
  id: string;
  queueName: string;
  body: string;
  headers: Record<string, string>;
  createdAt: number;
  deliveryCount: number;
  visibleAt: number;
  ackId: string | null;
}

export interface Queue {
  name: string;
  messages: Message[];
  consumers: string[];
}

export interface PublishInput {
  body: string;
  headers?: Record<string, string>;
}

export interface Topic {
  name: string;
  subscribers: string[];
}
