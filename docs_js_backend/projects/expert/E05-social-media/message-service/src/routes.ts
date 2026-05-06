import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string; // BUG: stored in plaintext, no encryption
  createdAt: string;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  lastMessageAt: string;
}

const messages: Map<string, Message> = new Map();
const conversations: Map<string, Conversation> = new Map();

function getUserId(req: any): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string };
    return payload.userId;
  } catch {
    return null;
  }
}

function getConversationId(a: string, b: string): string {
  return [a, b].sort().join(':');
}

const router = Router();

router.post('/', (req, res, next) => {
  try {
    const senderId = getUserId(req);
    if (!senderId) return res.status(401).json({ error: 'Unauthorized' });
    const { receiverId, content } = req.body;
    if (!receiverId || !content) return res.status(400).json({ error: 'Missing fields' });

    // BUG: Content is stored as plaintext without any encryption.
    // This is a privacy breach; anyone with DB access can read all DMs.
    const message: Message = {
      id: uuidv4(),
      senderId,
      receiverId,
      content, // PLAINTEXT STORAGE - INTENTIONAL BUG
      createdAt: new Date().toISOString(),
    };
    messages.set(message.id, message);

    const convId = getConversationId(senderId, receiverId);
    const conv = conversations.get(convId) || { id: convId, participantIds: [senderId, receiverId], lastMessageAt: message.createdAt };
    conv.lastMessageAt = message.createdAt;
    conversations.set(convId, conv);

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

router.get('/conversation/:userId', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const otherId = req.params.userId;
    const convId = getConversationId(userId, otherId);
    const list = Array.from(messages.values())
      .filter((m) => getConversationId(m.senderId, m.receiverId) === convId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.get('/conversations', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const list = Array.from(conversations.values()).filter((c) => c.participantIds.includes(userId));
    res.json(list);
  } catch (err) {
    next(err);
  }
});

export { messages, conversations };
export default router;
