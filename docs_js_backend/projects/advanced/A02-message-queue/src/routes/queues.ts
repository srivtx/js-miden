import { Router } from 'express';
import { queues } from '../db.js';
import type { Message, Queue, PublishInput } from '../types.js';
import { config } from '../config.js';

const router = Router();

function getOrCreateQueue(name: string): Queue {
  if (!queues.has(name)) {
    queues.set(name, { name, messages: [], consumers: [] });
  }
  return queues.get(name)!;
}

router.post('/:queue/messages', (req, res) => {
  const queueName = req.params.queue;
  const { body, headers = {} }: PublishInput = req.body;
  
  const queue = getOrCreateQueue(queueName);
  const message: Message = {
    id: crypto.randomUUID(),
    queueName,
    body,
    headers,
    createdAt: Date.now(),
    deliveryCount: 0,
    visibleAt: Date.now(),
    ackId: null,
  };
  
  // BUG: No ordering guarantee - push to end but consumers might process from middle
  queue.messages.push(message);
  
  res.status(201).json({ id: message.id, queue: queueName });
});

router.get('/:queue/messages', (req, res) => {
  const queueName = req.params.queue;
  const queue = getOrCreateQueue(queueName);
  const now = Date.now();
  
  // BUG: No ordering guarantee - finds any visible message, not oldest
  const idx = queue.messages.findIndex(m => m.visibleAt <= now);
  if (idx === -1) {
    res.status(204).send();
    return;
  }
  
  const message = queue.messages[idx];
  message.deliveryCount++;
  message.visibleAt = now + config.defaultVisibilityTimeoutMs;
  message.ackId = crypto.randomUUID();
  
  res.json({
    id: message.id,
    body: message.body,
    headers: message.headers,
    deliveryCount: message.deliveryCount,
    ackId: message.ackId,
  });
});

router.post('/:queue/messages/:id/ack', (req, res) => {
  const { queue: queueName, id } = req.params;
  const { ackId } = req.body;
  const queue = getOrCreateQueue(queueName);
  
  const idx = queue.messages.findIndex(m => m.id === id && m.ackId === ackId);
  if (idx === -1) {
    res.status(404).json({ error: 'Message not found or invalid ackId' });
    return;
  }
  
  queue.messages.splice(idx, 1);
  res.json({ acknowledged: true });
});

router.get('/:queue/stats', (req, res) => {
  const queue = getOrCreateQueue(req.params.queue);
  res.json({
    name: queue.name,
    messageCount: queue.messages.length,
    consumerCount: queue.consumers.length,
  });
});

export { router as queuesRouter };
