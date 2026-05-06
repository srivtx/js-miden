export interface DeviceToken {
  token: string;
  platform: 'ios' | 'android';
  userId?: string;
  createdAt: Date;
}

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  tokens: string[];
  status: 'pending' | 'sent' | 'failed';
  results?: PushResult[];
  createdAt: Date;
}

export interface PushResult {
  token: string;
  success: boolean;
  error?: string;
}
