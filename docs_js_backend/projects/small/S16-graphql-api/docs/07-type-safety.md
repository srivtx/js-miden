# 07-type-safety.md

## WHAT

Type safety ensures resolvers return data matching the schema types.

## WHY

Without type safety, runtime errors occur when resolvers return wrong shapes. TypeScript + GraphQL codegen provides compile-time guarantees.

## HOW

Use TypeScript interfaces that mirror GraphQL types:

```typescript
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
```

Consider GraphQL Code Generator to auto-generate TypeScript types from the schema.
