import DataLoader from 'dataloader';
import { prisma } from '../config/index.js';

async function batchUsers(ids: readonly string[]) {
  const users = await prisma.user.findMany({
    where: { id: { in: [...ids] } },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));
  return ids.map((id) => userMap.get(id) ?? null);
}

async function batchPosts(ids: readonly string[]) {
  const posts = await prisma.post.findMany({
    where: { id: { in: [...ids] } },
  });
  const postMap = new Map(posts.map((p) => [p.id, p]));
  return ids.map((id) => postMap.get(id) ?? null);
}

async function batchCommentsByPostIds(postIds: readonly string[]) {
  const comments = await prisma.comment.findMany({
    where: { postId: { in: [...postIds] } },
    orderBy: { createdAt: 'desc' },
  });
  const commentMap = new Map<string, typeof comments>();
  for (const comment of comments) {
    const list = commentMap.get(comment.postId) ?? [];
    list.push(comment);
    commentMap.set(comment.postId, list);
  }
  return postIds.map((id) => commentMap.get(id) ?? []);
}

export function createLoaders() {
  return {
    userLoader: new DataLoader(batchUsers, {
      cacheKeyFn: (key) => key,
      batchScheduleFn: (callback) => setTimeout(callback, 1),
    }),
    postLoader: new DataLoader(batchPosts, {
      cacheKeyFn: (key) => key,
      batchScheduleFn: (callback) => setTimeout(callback, 1),
    }),
    commentsByPostLoader: new DataLoader(batchCommentsByPostIds, {
      cacheKeyFn: (key) => key,
      batchScheduleFn: (callback) => setTimeout(callback, 1),
    }),
  };
}