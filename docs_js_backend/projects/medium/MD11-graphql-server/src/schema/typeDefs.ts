export const typeDefs = `#graphql
  type Query {
    # User queries
    users(limit: Int = 20, offset: Int = 0): [User!]!
    user(id: ID!): User
    userById(id: ID!): User
    me: User

    # Post queries
    posts(limit: Int = 20, offset: Int = 0): [Post!]!
    post(id: ID!): Post
    postById(id: ID!): Post

    # Comment queries
    comments(postId: ID!): [Comment!]!

    # Analytics
    _service: _Service
  }

  type Mutation {
    createPost(input: CreatePostInput!): Post!
    updatePost(id: ID!, input: UpdatePostInput!): Post!
    deletePost(id: ID!): Boolean!
    createComment(input: CreateCommentInput!): Comment!
  }

  type Subscription {
    postCreated: Post!
    commentAdded(postId: ID!): Comment!
    userUpdated(id: ID!): User!
  }

  type User {
    id: ID!
    email: String!
    name: String!
    role: Role!
    posts(limit: Int = 20, offset: Int = 0): [Post!]!
    comments: [Comment!]!
    createdAt: String!
    updatedAt: String!
  }

  type Post {
    id: ID!
    title: String!
    content: String!
    published: Boolean!
    author: User!
    comments(limit: Int = 20, offset: Int = 0): [Comment!]!
    createdAt: String!
    updatedAt: String!
  }

  type Comment {
    id: ID!
    content: String!
    post: Post!
    author: User!
    createdAt: String!
  }

  enum Role {
    USER
    ADMIN
    MODERATOR
  }

  input CreatePostInput {
    title: String!
    content: String!
    published: Boolean = false
  }

  input UpdatePostInput {
    title: String
    content: String
    published: Boolean
  }

  input CreateCommentInput {
    postId: ID!
    content: String!
  }

  type _Service {
    sdl: String
  }
`;