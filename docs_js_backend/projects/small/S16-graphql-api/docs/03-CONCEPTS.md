# 03-CONCEPTS.md

## WHAT: GraphQL Core Concepts

### Schema

The schema is the API contract. It defines what data exists and how to fetch/modify it.

```
Schema as a Graph:

    Query
   /  |  \
posts post authors
 |    |    |
Post Post  Author
 |         /  \
author   name  email
```

### Types

```typescript
// WHAT: GraphQLObjectType defines a domain entity
// WHY: Strong typing prevents runtime errors and documents the API
// HOW: Each field has a type and optionally a resolver

const postType = new GraphQLObjectType({
  name: 'Post',
  fields: () => ({
    id: { type: GraphQLID },
    title: { type: GraphQLString },
    content: { type: GraphQLString },
    author: {
      type: authorType,
      resolve: (post) => getAuthor(post.authorId), // Field-level resolver
    },
  }),
});
```

### Queries (Read)

```graphql
# WHAT: A query asks for data
# WHY: Clients declare exactly what they need
# HOW: The execution engine runs resolvers for each field

query {
  posts {
    id
    title
    author { name }
  }
}
```

### Mutations (Write)

```graphql
# WHAT: A mutation changes data
# WHY: Side effects are explicit and separated from reads
# HOW: Returns the modified object so clients can update cache

mutation {
  createPost(title: "Hello", content: "World", authorId: "1") {
    id
    title
    author { name }
  }
}
```

### Resolvers

```typescript
// WHAT: Functions that return data for a field
// WHY: Each field can have independent data fetching logic
// HOW: Receive (parent, args, context, info)

resolve: (parent, args, context, info) => {
  // parent: The result of the parent field resolver
  // args: Arguments passed to the field
  // context: Shared per-request object (auth, loaders)
  // info: AST and execution metadata
}
```

## WHY: The N+1 Problem

GraphQL's flexibility creates a performance trap.

```
WRONG: Naive Implementation

Client: { posts { title author { name } } }

Server:
  getPosts()        -> 1 query, returns 100 posts
  getAuthor(post1)  -> query #2
  getAuthor(post2)  -> query #3
  ...
  getAuthor(post100)-> query #101

Total: 101 database queries
```

```
RIGHT: DataLoader Batching

Client: { posts { title author { name } } }

Server:
  getPosts()                      -> 1 query
  authorLoader.load(post1.authorId) -> queued
  authorLoader.load(post2.authorId) -> queued
  ...
  authorLoader.load(post100.authorId) -> queued
  
  DataLoader batches all loads in next tick:
  getAuthors([id1, id2, ..., id100]) -> 1 query

Total: 2 database queries
```

## HOW: Depth Limiting

GraphQL schemas can be recursive. A `Post` has an `Author` who has `Posts`...

```graphql
# WRONG: No depth limit allows this attack
query Attack {
  posts {
    author {
      posts {
        author {
          posts {
            author {
              posts { ... } # Could recurse 1000+ levels
            }
          }
        }
      }
    }
  }
}
```

```typescript
// RIGHT: Parse AST and calculate maximum nesting depth

function getDepth(node: any, currentDepth = 0): number {
  if (!node.selectionSet) return currentDepth;
  
  let maxDepth = currentDepth;
  for (const selection of node.selectionSet.selections) {
    maxDepth = Math.max(maxDepth, getDepth(selection, currentDepth + 1));
  }
  return maxDepth;
}

if (getDepth(queryAst) > maxDepth) {
  throw new Error('Query too deep');
}
```

## WRONG vs RIGHT: Type Safety

```typescript
// WRONG: Any types, no compile-time guarantees
const resolvers = {
  posts: () => db.query('SELECT * FROM posts'), // Returns any
};

// Client might request `author.phone` but Author has no phone field
// This is a runtime error, not compile-time
```

```typescript
// RIGHT: TypeScript interfaces mirror GraphQL types
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

// Resolvers are typed:
function getPosts(): Post[] { ... }
function getAuthor(id: string): Author | undefined { ... }

// Even better: Use GraphQL Code Generator to auto-generate
// types from the schema so TypeScript and GraphQL never drift
```
