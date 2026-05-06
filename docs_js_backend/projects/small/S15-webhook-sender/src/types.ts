export interface Webhook {
  id: number;
  url: string;
  secret: string;
  event_types: string[];
  created_at: Date;
}

export interface DeliveryLog {
  id: number;
  webhook_id: number;
  event_type: string;
  payload: object;
  status: 'pending' | 'success' | 'failed';
  response_status?: number;
  response_body?: string;
  attempt_count: number;
  next_retry_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface RegisterWebhookRequest {
  url: string;
  event_types: string[];
  secret?: string;
}

export interface SendEventRequest {
  event_type: string;
  payload: object;
}
