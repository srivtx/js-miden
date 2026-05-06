export const pushChannel = {
  async send(userId: string, content: string) {
    // Stub for Firebase Cloud Messaging
    console.log(`[PUSH] to ${userId}: ${content}`);
    return { success: true, channel: 'push' };
  },
};
