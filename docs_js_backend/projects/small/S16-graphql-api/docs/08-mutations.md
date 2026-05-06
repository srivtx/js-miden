# 08-mutations.md

## WHAT

Mutations modify data: createPost, updatePost.

## WHY

GraphQL separates reads (queries) from writes (mutations) to make side effects explicit.

## HOW

```graphql
mutation {
  createPost(title: "Hello", content: "World", authorId: "1") {
    id
    title
    author { name }
  }
}
```

Return the created/updated object so clients can update their cache without a refetch.
