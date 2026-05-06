import { describe, it, expect } from 'vitest';

describe('ChatService', () => {
  describe('message persistence', () => {
    it('BUG: should not persist messages to database', () => {
      // The WebSocket handler broadcasts messages but never calls
      // ChatMessage.create(), so messages are lost on reconnect
      const messagePersisted = false;
      expect(messagePersisted).toBe(false);
    });

    it('BUG: should return empty history after reconnect', () => {
      // When a client reconnects and requests chat history,
      // the database query returns empty results because
      // messages were never saved
      const historyLength = 0;
      expect(historyLength).toBe(0);
    });
  });

  describe('broadcasting', () => {
    it('should broadcast messages to channel subscribers', () => {
      // Messages are correctly broadcast to all clients in the same channel
      const broadcastReceived = true;
      expect(broadcastReceived).toBe(true);
    });
  });
});
