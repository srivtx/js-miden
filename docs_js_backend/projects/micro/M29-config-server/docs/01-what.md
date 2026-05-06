# WHAT: Config Server

A Config Server is a centralized service that stores and distributes configuration properties to applications across different environments.

## Core Responsibilities

1. **Centralization**: Store all configuration in one place instead of scattered files.
2. **Environment Isolation**: Keep dev, staging, and prod configurations separate.
3. **Validation**: Reject invalid or malformed configuration values.

## What This Project Does

This project implements a minimal config server that:

- Stores key-value configuration per application
- Supports `dev`, `staging`, and `prod` environments
- Validates configuration values before storing
- Returns the appropriate config based on app name and environment

## Simplified Architecture

```
┌──────────┐  GET /config/myapp/prod  ┌──────────┐
│  App     │ ───────────────────────▶ │ Config   │
│  Client  │ ◀─────────────────────── │ Server   │
└──────────┘   { dbHost, apiKey }     │  :3000   │
                                      └──────────┘
```

## Key Terms

| Term | Definition |
|------|------------|
| Environment | A deployment stage (dev, staging, prod) with its own settings. |
| Centralized Config | Storing all application settings in a single service. |
| Validation | Ensuring configuration values meet expected formats or constraints. |
