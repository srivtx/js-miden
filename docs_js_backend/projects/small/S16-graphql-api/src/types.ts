import { GraphQLObjectType, GraphQLString, GraphQLInt, GraphQLID } from 'graphql';
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
