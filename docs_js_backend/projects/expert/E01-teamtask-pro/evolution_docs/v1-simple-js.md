# v1 — The Naive Task Tracker (Pure JS)

You need to track tasks for your team. You build a quick Express API in an afternoon.

```js
const express = require('express');
const app = express();

const tasks = [];
let idCounter = 1;

app.use(express.json());

app.post('/tasks', (req, res) => {
  const task = { id: idCounter++, ...req.body, createdAt: new Date() };
  tasks.push(task);
  res.status(201).json(task);
});

app.get('/tasks', (req, res) => {
  res.json(tasks);
});

app.get('/tasks/:id', (req, res) => {
  const task = tasks.find(t => t.id === parseInt(req.params.id));
  if (!task) return res.status(404).json({ error: 'Not found' });
  res.json(task);
});

app.put('/tasks/:id', (req, res) => {
  const idx = tasks.findIndex(t => t.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  tasks[idx] = { ...tasks[idx], ...req.body };
  res.json(tasks[idx]);
});

app.delete('/tasks/:id', (req, res) => {
  const idx = tasks.findIndex(t => t.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  tasks.splice(idx, 1);
  res.json({ deleted: true });
});

app.listen(3000, () => console.log('Task tracker on 3000'));
```

It works. You can create, read, update, delete. Your team starts using it.

## Then the Pain Hits

**No persistence.** Restart the server and every task vanishes. The array is in memory only. You lose data on every deploy.

**No validation.** A user sends `{ "title": null, "priority": "banana" }` and your app stores it. Tasks with no title break the frontend. Invalid priorities render as blank badges.

**No users.** Anyone can hit any endpoint. There's no concept of who created what. Alice edits Bob's task. Bob deletes Alice's entire project. No accountability.

**No organization.** All tasks live in one flat array. Team A sees Team B's internal tasks. A freelancer sees your CEO's private roadmap.

**No relationships.** A task has no project. A project has no owner. You can't answer "what are all tasks for the Q3 redesign?"

## The Realization

A task tracker without users, organizations, and persistence is a demo. To become a SaaS, you need:
1. **Database persistence** — survive restarts
2. **User authentication** — know who is doing what
3. **Organizations** — scope data to teams
4. **Validation** — reject garbage at the gate
5. **Relationships** — projects contain tasks, users own projects

This is where the evolution starts.
