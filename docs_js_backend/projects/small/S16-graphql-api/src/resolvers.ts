import DataLoader from 'dataloader';

interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
}

interface Author {
  id: string;
  name: string;
  email: string;
}

const authors: Author[] = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
];

const posts: Post[] = [
  { id: '1', title: 'Hello World', content: 'First post', authorId: '1' },
  { id: '2', title: 'GraphQL 101', content: 'Intro to GraphQL', authorId: '1' },
  { id: '3', title: 'Event Sourcing', content: 'Events everywhere', authorId: '2' },
];

// BUG: N+1 problem - each post's author resolver calls getAuthor separately
// DataLoader is imported but NOT USED in the getAuthor function below
export function getAuthor(id: string): Author | undefined {
  console.log(`Fetching author ${id}`);
  return authors.find(a => a.id === id);
}

// The correct implementation would use DataLoader:
// const authorLoader = new DataLoader<string, Author | undefined>(async (ids) => {
//   console.log(`Batch fetching authors: ${ids}`);
//   return ids.map(id => authors.find(a => a.id === id));
// });
// export function getAuthor(id: string) { return authorLoader.load(id); }

export function getPosts(): Post[] {
  return posts;
}

export function getPost(id: string): Post | undefined {
  return posts.find(p => p.id === id);
}

export function getAuthors(): Author[] {
  return authors;
}

export function createPost(args: { title: string; content: string; authorId: string }): Post {
  const post: Post = {
    id: String(posts.length + 1),
    title: args.title,
    content: args.content,
    authorId: args.authorId,
  };
  posts.push(post);
  return post;
}

export function updatePost(args: { id: string; title?: string; content?: string }): Post | undefined {
  const post = posts.find(p => p.id === args.id);
  if (!post) return undefined;
  if (args.title) post.title = args.title;
  if (args.content) post.content = args.content;
  return post;
}
