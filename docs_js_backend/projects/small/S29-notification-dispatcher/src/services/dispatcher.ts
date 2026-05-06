import { emailChannel } from './channels/email.js';
import { smsChannel } from './channels/sms.js';
import { pushChannel } from './channels/push.js';
import { websocketChannel } from './channels/websocket.js';
import { renderTemplate } from './templates.js';
import { getUserPreferences } from './preferences.js';

const channels: Record<string, any> = {
  email: emailChannel,
  sms: smsChannel,
  push: pushChannel,
  inapp: websocketChannel,
};

export async function dispatch(userId: string, channelNames: string[], templateName: string, vars: Record<string, string>) {
  const content = await renderTemplate(templateName, vars);
  const preferences = await getUserPreferences(userId);

  const results: Record<string, any> = {};

  // BUG: ignores preferences, sends to all requested channels
  for (const name of channelNames) {
    const channel = channels[name];
    if (!channel) continue;
    results[name] = await channel.send(userId, content);
  }

  return { userId, sent: results };
}
