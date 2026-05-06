import { Router, Request, Response } from 'express';

interface UserV1 {
  id: string;
  name: string;
}

interface UserV2 {
  id: string;
  firstName: string;
  lastName: string;
}

const usersV1: UserV1[] = [
  { id: '1', name: 'Alice Johnson' },
  { id: '2', name: 'Bob Smith' },
];

const usersV2: UserV2[] = [
  { id: '1', firstName: 'Alice', lastName: 'Johnson' },
  { id: '2', firstName: 'Bob', lastName: 'Smith' },
];

export const v1Router = Router();
export const v2Router = Router();

v1Router.get('/users', (req: Request, res: Response) => {
  // BUG: Breaking change without version bump
  // v1 suddenly returns V2 format - breaking existing clients
  res.json(usersV2.map(transformV2toV1));
});

v1Router.get('/users/:id', (req: Request, res: Response) => {
  const user = usersV2.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(transformV2toV1(user));
});

v2Router.get('/users', (req: Request, res: Response) => {
  res.json(usersV2);
});

v2Router.get('/users/:id', (req: Request, res: Response) => {
  const user = usersV2.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

export function transformV1toV2(user: UserV1): UserV2 {
  const parts = user.name.split(' ');
  return {
    id: user.id,
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

export function transformV2toV1(user: UserV2): UserV1 {
  // BUG: v1 format changed to return split name in a single string
  // This actually returns a name but it's constructed from firstName+lastName
  // The real bug is v1 suddenly returning different structure
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
  };
}
