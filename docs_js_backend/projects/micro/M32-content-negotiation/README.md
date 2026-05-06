# M32: Content Negotiation Middleware

Content negotiation middleware for Express.js supporting JSON, XML, HTML, and plain text.

## Features
- Parses `Accept` header with q-values
- Selects best format based on client priority
- Defaults to JSON when no match
- Extensible formatter system

## Run

```bash
npm install
npm run dev
npm test
npm run build
npm start
```

## Docker
```bash
docker-compose up
```

## API
- `GET /resource` - Returns resource in negotiated format
- `GET /default` - Default negotiation example
