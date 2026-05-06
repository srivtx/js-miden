# M32: Core Concepts

## WHAT
Content negotiation lets server and client agree on a response format via the `Accept` header.

## WHY
A mobile app wants JSON; a browser wants HTML; a legacy system wants XML. One endpoint serves all.

## HOW
```ts
const items = parseAcceptHeader('text/html, application/json;q=0.9');
// [{type:'text',subtype:'html',q:1.0}, {type:'application',subtype:'json',q:0.9}]
```

## WRONG vs RIGHT

**WRONG**: Exact string match ignoring wildcards
```ts
if (item.type === 'application' && item.subtype === 'json') // fails for */*
```

**RIGHT**: Check wildcards before exact types
```ts
if (
  (item.type === type && item.subtype === s) ||
  (item.type === type && item.subtype === '*') ||
  (item.type === '*' && item.subtype === '*')
) return format;
```
