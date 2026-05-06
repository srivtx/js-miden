# M33: UUID Generation Service

REST service for generating UUID v4, v7, and ULID identifiers.

## Features
- `GET /uuid/v4` - Random UUID
- `GET /uuid/v7` - Time-ordered UUID
- `GET /uuid/ulid` - Lexicographically sortable ULID
- `POST /uuid/bulk` - Bulk generation

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

### Single UUID
```bash
curl http://localhost:3000/uuid/v4
curl http://localhost:3000/uuid/v7
curl http://localhost:3000/uuid/ulid
```

### Bulk
```bash
curl -X POST http://localhost:3000/uuid/bulk \
  -H "Content-Type: application/json" \
  -d '{"count":5,"type":"v7"}'
```
