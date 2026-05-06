# 03-schema-design.md

## WHAT

Schema design defines the shape of the API: types, fields, relationships, and operations.

## WHY

Good schema design is the foundation of a GraphQL API. It should model the domain, not the database. Types should be reusable and composable.

## HOW

```graphql
type Post {
  id: ID!
  title: String!
  content: String!
  author: Author!
}

type Author {
  id: ID!
  name: String!
  email: String!
}

type Query {
  posts: [Post!]!
  post(id: ID!): Post
  authors: [Author!]!
}

type Mutation {
  createPost(title: String!, content: String!, authorId: ID!): Post!
  updatePost(id: ID!, title: String, content: String): Post
}
```
