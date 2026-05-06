# M29: Config Server

A centralized configuration server that stores and serves configuration per application and environment.

## Features

- `POST /config/:app/:env` - Set configuration for an app in an environment
- `GET /config/:app/:env` - Get configuration for an app in an environment
- Support for `dev`, `staging`, and `prod` environments
- Validation of configuration values

## Bug Introduced

The server has **no environment isolation**. Configurations are stored only by application name, so writing a value to `dev` overwrites the same key in `prod`. This causes production services to receive development configuration.

## Project Structure

```
M29-config-server/
├── src/
│   ├── index.ts      # Express server setup
│   ├── config.ts     # Config storage and retrieval
│   └── validator.ts  # Config validation
├── tests/
│   └── config.test.ts
├── docs/
│   ├── 01-what.md
│   ├── 02-why.md
│   ├── 03-how.md
│   ├── 04-wrong-vs-right.md
│   ├── 05-architecture.md
│   ├── 06-setup.md
│   ├── 07-testing.md
│   ├── 08-troubleshooting.md
│   └── 09-reference.md
├── package.json
├── tsconfig.json
└── README.md
```

## Quick Start

```bash
npm install
npm run dev    # Start config server on :3000
npm test       # Run tests (some will fail due to the bug)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/config/:app/:env` | Set config for app+env |
| GET    | `/config/:app/:env` | Get config for app+env |

## Testing the Bug

Run `npm test`. The environment isolation test will fail because `dev` and `prod` share the same configuration namespace.
