# M34: HTTP Header Validation Middleware

Header validation middleware with strict and lenient modes.

## Features
- Validates Content-Type, Authorization, and custom headers
- Strict mode: rejects invalid requests (400)
- Lenient mode: warns but allows
- Configurable rules via RegExp or functions

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
- `GET /public` - Lenient validation
- `POST /private` - Strict validation (requires X-Custom-Token)
