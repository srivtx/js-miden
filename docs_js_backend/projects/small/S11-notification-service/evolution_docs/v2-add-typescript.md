# v2 — Adding TypeScript

You just debugged why a user's unread count showed `undefined`.

```js
const count = notifications[user_id].filter(n => !n.read).length;
```

Someone sent `user_id: 123` (a number). Your object keys are strings. `notifications[123]` worked because JavaScript coerces numbers to strings. But somewhere else, you did strict comparison `userId === user_id` and it failed because one was a number and one was a string.

You spent an hour chasing type coercion bugs.

## The Fix: Types

```ts
interface Notification {
  id: number;
  user_id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: number;
}

app.post('/notify', (req: Request, res: Response) => {
  const { user_id, title, body } = req.body;
  // user_id is typed as string
  // No more number/string confusion
});
```

## But Wait...

TypeScript doesn't validate at runtime. A client can still send `{ "user_id": 123 }` and your code will accept it. Also, your notifications are still in memory.

**Next:** Let's add a database and validation.
