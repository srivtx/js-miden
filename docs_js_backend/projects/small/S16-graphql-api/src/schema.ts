import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLID } from 'graphql';
import { postType, authorType } from './types.js';
import { getPosts, getPost, getAuthors, createPost, updatePost } from './resolvers.js';

const queryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    posts: {
      type: new GraphQLList(postType),
      resolve: getPosts,
    },
    post: {
      type: postType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
      },
      resolve: (_, args) => getPost(args.id),
    },
    authors: {
      type: new GraphQLList(authorType),
      resolve: getAuthors,
    },
  },
});

const mutationType = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    createPost: {
      type: postType,
      args: {
        title: { type: new GraphQLNonNull(GraphQLString) },
        content: { type: new GraphQLNonNull(GraphQLString) },
        authorId: { type: new GraphQLNonNull(GraphQLID) },
      },
      resolve: (_, args) => createPost(args),
    },
    updatePost: {
      type: postType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        title: { type: GraphQLString },
        content: { type: GraphQLString },
      },
      resolve: (_, args) => updatePost(args),
    },
  },
});

export const schema = new GraphQLSchema({
  query: queryType,
  mutation: mutationType,
});
