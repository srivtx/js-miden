import { GraphQLError } from 'graphql';
import { prisma } from '../config/index.js';
import { pubsub } from '../subscriptions/pubsub.js';
import type { Context } from '../server.js';

export const resolvers = {
  Query: {
    users: async (_: unknown, { limit, offset }: { limit: number; offset: number }) => {
      return prisma.user.findMany({
        take: Math.min(limit, 100),
        skip: offset,
        orderBy: { createdAt: 'desc' },
      });
    },

    user: async (_: unknown, { id }: { id: string }) => {
      return prisma.user.findUnique({ where: { id } });
    },

    userById: async (_: unknown, { id }: { id: string }) => {
      return prisma.user.findUnique({ where: { id } });
    },

    me: async (_: unknown, __: unknown, context: Context) => {
      if (!context.userId) return null;
      return prisma.user.findUnique({ where: { id: context.userId } });
    },

    posts: async (_: unknown, { limit, offset }: { limit: number; offset: number }) => {
      return prisma.post.findMany({
        take: Math.min(limit, 100),
        skip: offset,
        orderBy: { createdAt: 'desc' },
      });
    },

    post: async (_: unknown, { id }: { id: string }) => {
      return prisma.post.findUnique({ where: { id } });
    },

    postById: async (_: unknown, { id }: { id: string }) => {
      return prisma.post.findUnique({ where: { id } });
    },

    comments: async (_: unknown, { postId }: { postId: string }) => {
      return prisma.comment.findMany({
        where: { postId },
        orderBy: { createdAt: 'desc' },
      });
    },

    _service: () => ({
      sdl: 'type Query { users: [User] }',
    }),
  },

  Mutation: {
    createPost: async (
      _: unknown,
      { input }: { input: { title: string; content: string; published?: boolean } },
      context: Context
    ) => {
      if (!context.userId) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const post = await prisma.post.create({
        data: {
          title: input.title,
          content: input.content,
          published: input.published ?? false,
          authorId: context.userId,
        },
        include: { author: true },
      });

      await pubsub.publish('POST_CREATED', { postCreated: post });
      return post;
    },

    updatePost: async (
      _: unknown,
      { id, input }: { id: string; input: { title?: string; content?: string; published?: boolean } },
      context: Context
    ) => {
      if (!context.userId) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const post = await prisma.post.update({
        where: { id, authorId: context.userId },
        data: input,
        include: { author: true },
      });

      await pubsub.publish('POST_UPDATED', { postUpdated: post });
      return post;
    },

    deletePost: async (_: unknown, { id }: { id: string }, context: Context) => {
      if (!context.userId) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      await prisma.post.delete({ where: { id, authorId: context.userId } });
      return true;
    },

    createComment: async (
      _: unknown,
      { input }: { input: { postId: string; content: string } },
      context: Context
    ) => {
      if (!context.userId) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const comment = await prisma.comment.create({
        data: {
          content: input.content,
          postId: input.postId,
          authorId: context.userId,
        },
        include: { post: true, author: true },
      });

      await pubsub.publish(`COMMENT_ADDED_${input.postId}`, { commentAdded: comment });
      return comment;
    },
  },

  Subscription: {
    postCreated: {
      subscribe: () => pubsub.asyncIterator(['POST_CREATED']),
    },
    commentAdded: {
      subscribe: (_: unknown, { postId }: { postId: string }) =>
        pubsub.asyncIterator([`COMMENT_ADDED_${postId}`]),
    },
    userUpdated: {
      subscribe: (_: unknown, { id }: { id: string }) => pubsub.asyncIterator([`USER_UPDATED_${id}`]),
    },
  },

  User: {
    posts: async (parent: { id: string }, { limit, offset }: { limit: number; offset: number }) => {
      return prisma.post.findMany({
        where: { authorId: parent.id },
        take: Math.min(limit, 100),
        skip: offset,
        orderBy: { createdAt: 'desc' },
      });
    },
    comments: async (parent: { id: string }) => {
      return prisma.comment.findMany({
        where: { authorId: parent.id },
        orderBy: { createdAt: 'desc' },
      });
    },
  },

  Post: {
    author: async (parent: { authorId: string }, _: unknown, context: Context) => {
      return context.loaders.userLoader.load(parent.authorId);
    },
    comments: async (parent: { id: string }, { limit, offset }: { limit: number; offset: number }) => {
      return prisma.comment.findMany({
        where: { postId: parent.id },
        take: Math.min(limit, 100),
        skip: offset,
        orderBy: { createdAt: 'desc' },
      });
    },
  },

  Comment: {
    post: async (parent: { postId: string }, _: unknown, context: Context) => {
      return context.loaders.postLoader.load(parent.postId);
    },
    author: async (parent: { authorId: string }, _: unknown, context: Context) => {
      return context.loaders.userLoader.load(parent.authorId);
    },
  },
};