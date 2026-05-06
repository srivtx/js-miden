# M35: Timezone Conversion API

Timezone conversion API with IANA timezone support.

## Features
- Convert times between timezones
- List supported timezones
- ISO 8601 input/output

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

### Convert
```bash
curl "http://localhost:3000/convert?from=UTC&to=Asia/Tokyo&time=2024-01-01T00:00:00Z"
```

### List Timezones
```bash
curl http://localhost:3000/timezones
```
