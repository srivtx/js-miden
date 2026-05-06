# S16 GraphQL API — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You add GraphQL:

```js
const { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLList, GraphQLNonNull, GraphQLID } = require('graphql');

const postType = new GraphQLObjectType({
  name: 'Post',
  fields: {
    id: { type: GraphQLID },
    title: { type: GraphQLString },
    content: { type: GraphQLString },
    author: {
      type: authorType,
      resolve: (post) => getAuthor(post.authorId),
    },
  },
});
```

**The bug:** `getAuthor` is called for every post. If a query requests 100 posts with their authors, you make 100 separate `getAuthor` calls. This is the N+1 problem. TypeScript doesn't catch it because the types are correct — the performance is terrible.

Another bug: you treat `args.id` as a string but it might be a number:

```js
resolve: (_, args) => getPost(args.id), // args.id is GraphQLID (string), but getPost expects string
```

TypeScript would enforce the type but the N+1 problem remains.

## The Fix: Add TypeScript

```ts
// types.ts
import { GraphQLObjectType, GraphQLString, GraphQLID } from 'graphql';
import { getAuthor } from './resolvers.js';

export const authorType = new GraphQLObjectType({
  name: 'Author',
  fields: () => ({
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    email: { type: GraphQLString },
  }),
});

export const postType = new GraphQLObjectType({
  name: 'Post',
  fields: () => ({
    id: { type: GraphQLID },
    title: { type: GraphQLString },
    content: { type: GraphQLString },
    author: {
      type: authorType,
      resolve: (post) => getAuthor(post.authorId),
    },
    authorId: { type: GraphQLID },
  }),
});
```

```ts
// resolvers.ts
interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
}

interface Author {
  id: string;
  name: string;
  email: string;
}

const authors: Author[] = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
];

const posts: Post[] = [
  { id: '1', title: 'Hello World', content: 'First post', authorId: '1' },
  { id: '2', title: 'GraphQL 101', content: 'Intro to GraphQL', authorId: '1' },
  { id: '3', title: 'Event Sourcing', content: 'Events everywhere', authorId: '2' },
];

export function getAuthor(id: string): Author | undefined {
  console.log(`Fetching author ${id}`);
  return authors.find(a => a.id === id);
}

export function getPosts(): Post[] {
  return posts;
}

export function getPost(id: string): Post | undefined {
  return posts.find(p => p.id === id);
}

export function getAuthors(): Author[] {
  return authors;
}
```

Now `tsc` validates the resolver signatures. But it doesn't catch the N+1 problem.

## But TypeScript Doesn't Catch Everything

TypeScript validates **compile-time** shapes, not **runtime** performance. A client can still:
- Request 100 posts with authors → 101 database queries
- Request deeply nested queries → stack overflow
- Query recursive types infinitely → server hangs

We need DataLoader and depth limiting.

> **Lesson:** TypeScript eliminates typos and wrong shapes. But GraphQL performance requires query analysis and batching.

## What v3 Fixes

The N+1 problem. Batch author lookups with DataLoader.
