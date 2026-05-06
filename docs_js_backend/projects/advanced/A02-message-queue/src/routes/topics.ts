import { Router } from 'express';
import { topics, queues } from '../db.js';
import type { Topic, Message } from '../types.js';

const router = Router();

function getOrCreateTopic(name: string): Topic {
  if (!topics.has(name)) {
    topics.set(name, { name, subscribers: [] });
  }
  return topics.get(name)!;
}

router.post('/:topic/subscribe', (req, res) => {
  const topicName = req.params.topic;
  const { queueName } = req.body;
  const topic = getOrCreateTopic(topicName);
  if (!topic.subscribers.includes(queueName)) {
    topic.subscribers.push(queueName);
  }
  res.json({ subscribed: true, topic: topicName, queue: queueName });
});

router.post('/:topic/publish', (req, res) => {
  const topicName = req.params.topic;
  const { body, headers = {} } = req.body;
  const topic = getOrCreateTopic(topicName);
  
  for (const queueName of topic.subscribers) {
    const queue = queues.get(queueName) || { name: queueName, messages: [], consumers: [] };
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
    queue.messages.push(message);
    queues.set(queueName, queue);
  }
  
  res.json({ published: true, subscriberCount: topic.subscribers.length });
});

export { router as topicsRouter };
