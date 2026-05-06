# 02-architecture.md

## WHAT

The architecture uses Express with graphql-http middleware to handle GraphQL requests.

## WHY

Separating schema definition from resolver logic makes the codebase maintainable. Middleware can handle cross-cutting concerns like depth limiting and authentication.

## HOW

```
Client → Express → graphql-http → Schema → Resolvers → DataLoader → Data Store
```

- `schema.ts` defines the GraphQL schema
- `resolvers.ts` implements data fetching
- `middleware.ts` adds depth limiting
- `types.ts` defines GraphQL object types
