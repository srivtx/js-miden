import { DeviceToken, PushNotification, PushResult } from './types.js';

const tokens: Map<string, DeviceToken> = new Map();
const notifications: Map<string, PushNotification> = new Map();

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function isValidToken(token: string): boolean {
  // Basic validation: tokens should be non-empty and reasonable length
  return token.length >= 20 && token.length <= 500;
}

// Mock FCM provider
async function mockFcmSend(token: string, _title: string, _body: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (token.includes('invalid')) {
        resolve({ success: false, error: 'InvalidRegistration' });
      } else {
        resolve({ success: true });
      }
    }, 10);
  });
}

// Mock APNS provider
async function mockApnsSend(token: string, _title: string, _body: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (token.includes('invalid')) {
        resolve({ success: false, error: 'BadDeviceToken' });
      } else {
        resolve({ success: true });
      }
    }, 10);
  });
}

export async function registerToken(data: { token: string; platform: 'ios' | 'android'; userId?: string }): Promise<DeviceToken> {
  const deviceToken: DeviceToken = {
    token: data.token,
    platform: data.platform,
    userId: data.userId,
    createdAt: new Date(),
  };
  tokens.set(data.token, deviceToken);
  return deviceToken;
}

export function getTokens(): DeviceToken[] {
  return Array.from(tokens.values());
}

export async function sendPush(data: { title: string; body: string; tokens: string[]; data?: Record<string, unknown> }): Promise<PushNotification> {
  const notification: PushNotification = {
    id: generateId(),
    title: data.title,
    body: data.body,
    data: data.data,
    tokens: data.tokens,
    status: 'pending',
    createdAt: new Date(),
  };

  notifications.set(notification.id, notification);

  const results: PushResult[] = [];

  // BUG: No token validation — sends to invalid tokens, wasting resources.
  // We should validate tokens before attempting to send.
  for (const token of data.tokens) {
    const device = tokens.get(token);
    const provider = device?.platform === 'ios' ? mockApnsSend : mockFcmSend;
    const result = await provider(token, data.title, data.body);
    results.push({ token, success: result.success, error: result.error });
  }

  notification.results = results;
  notification.status = results.some(r => r.success) ? 'sent' : 'failed';

  return notification;
}

export async function sendBatch(data: { notifications: { title: string; body: string; tokens: string[]; data?: Record<string, unknown> }[] }): Promise<{ sent: number; failed: number; notifications: PushNotification[] }> {
  const sentNotifications: PushNotification[] = [];
  let sent = 0;
  let failed = 0;

  // BUG: No batching optimization — sends one by one.
  // For 10,000 users this makes 10,000 individual requests instead of batching.
  for (const item of data.notifications) {
    const notification = await sendPush(item);
    sentNotifications.push(notification);
    if (notification.status === 'sent') sent++;
    else failed++;
  }

  return { sent, failed, notifications: sentNotifications };
}

export async function getDeliveryStatus(id: string): Promise<PushNotification | undefined> {
  return notifications.get(id);
}
