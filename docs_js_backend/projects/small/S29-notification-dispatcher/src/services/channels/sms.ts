import twilio from 'twilio';

const client = twilio(process.env.TWILIO_SID || 'ACxxx', process.env.TWILIO_TOKEN || 'xxx');

export const smsChannel = {
  async send(userId: string, content: string) {
    await client.messages.create({
      body: content,
      from: process.env.TWILIO_PHONE || '+1234567890',
      to: '+1' + userId, // simplified
    });
    return { success: true, channel: 'sms' };
  },
};
