import type { ChangeEvent } from '../types.js';

const notifications: ChangeEvent[] = [];

export async function handleNotification(event: ChangeEvent): Promise<void> {
  // Simulate sending email/push notification
  notifications.push(event);
}

export function getNotifications(): ChangeEvent[] {
  return notifications;
}

export function clearNotifications(): void {
  notifications.length = 0;
}
