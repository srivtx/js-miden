import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025'),
});

export const emailChannel = {
  async send(userId: string, content: string) {
    // In real app, look up user's email by userId
    await transporter.sendMail({
      from: 'app@example.com',
      to: `${userId}@example.com`,
      subject: 'Notification',
      text: content,
    });
    return { success: true, channel: 'email' };
  },
};
