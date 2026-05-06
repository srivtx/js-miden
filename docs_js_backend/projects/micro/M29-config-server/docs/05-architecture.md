# Architecture: Config Server

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Config Server :3000                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │    Set      │  │     Get      │  │     Validator       │ │
│  │   Config    │  │   Config     │  │                     │ │
│  └─────────────┘  └──────────────┘  └─────────────────────┘ │
│                           │                                  │
│                    ┌──────┴──────┐                          │
│                    │    Store    │                          │
│                    │  (in-mem)   │                          │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
        ▲                                    ▲
        │ POST /config/app/env               │ GET /config/app/env
        │                                    │
┌───────┴───────┐                  ┌─────────┴─────────┐
│  Dev Machine  │                  │  Prod Service     │
│  (writes dev) │                  │  (reads prod)     │
└───────────────┘                  └───────────────────┘
```

## Data Flow

1. Developer posts config for `myapp/dev`.
2. Set Config Handler validates and stores in Store.
3. Production service requests `GET /config/myapp/prod`.
4. Get Config Handler retrieves the prod-specific config.
5. If no config exists, an empty object is returned.

## State Management

- `store`: nested object `store[app][env] = config`
- In-memory only; data is lost on restart
- Validation runs before every write

## Isolation Requirement

```
store = {
  "myapp": {
    "dev": { ... },
    "staging": { ... },
    "prod": { ... }
  }
}
```

Each environment must be an independent namespace.
