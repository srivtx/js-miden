# 04-resolvers.md

## WHAT

Resolvers are functions that return data for each field in the schema.

## WHY

Each field in a GraphQL query can have its own resolver. This allows fine-grained control over data fetching but can lead to the N+1 problem.

## HOW

```typescript
export const postType = new GraphQLObjectType({
  name: 'Post',
  fields: () => ({
    id: { type: GraphQLID },
    title: { type: GraphQLString },
    author: {
      type: authorType,
      resolve: (post) => getAuthor(post.authorId), // Called for each post!
    },
  }),
});
```

For 100 posts, `getAuthor` is called 100 times. Use DataLoader to batch these into a single query.
