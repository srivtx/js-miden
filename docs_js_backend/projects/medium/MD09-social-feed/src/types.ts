export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  followerCount: number;
  createdAt: Date;
}

export interface Post {
  id: string;
  authorId: string;
  content: string;
  likes: number;
  retweets: number;
  createdAt: Date;
}

export interface Follow {
  followerId: string;
  followeeId: string;
  createdAt: Date;
}

export interface FeedItem {
  postId: string;
  authorId: string;
  score: number;
}

export interface CreatePostInput {
  content: string;
}

export interface PlaceBidInput {
  amount: number;
}
