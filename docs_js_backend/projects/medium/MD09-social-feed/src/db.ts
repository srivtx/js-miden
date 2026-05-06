import type { User, Post, Follow } from '../types.js';

// In-memory store for testing/demo
export const users = new Map<string, User>();
export const posts = new Map<string, Post>();
export const follows = new Map<string, Follow>();
export const userFeeds = new Map<string, string[]>(); // userId -> postIds
export const likes = new Set<string>(); // postId:userId
export const retweets = new Set<string>(); // postId:userId

export function resetDb() {
  users.clear();
  posts.clear();
  follows.clear();
  userFeeds.clear();
  likes.clear();
  retweets.clear();
}
