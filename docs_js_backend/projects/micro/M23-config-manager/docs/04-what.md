# WHAT: Config Manager

## Definition

A configuration manager is a system that centralizes application settings, allowing runtime updates without code changes or restarts.

## Types of Configuration

### Static Config
- Set at deploy time
- Rarely changes (database host, port)

### Dynamic Config
- Changes at runtime
- Hot reloadable (feature flags, thresholds)

### Secret Config
- Sensitive data
- Encrypted at rest (API keys, passwords)

### Environment Config
- Varies by environment
- Dev/staging/prod differences

## Configuration Sources

1. **Environment Variables**: OS-level, secure
2. **Config Files**: JSON, YAML, TOML
3. **Config Servers**: Consul, etcd, Spring Cloud
4. **Databases**: Relational or key-value stores

## Key Metrics

- **Reload Latency**: Time to pick up changes
- **Validation Accuracy**: % of invalid configs caught
- **Availability**: Uptime of config service
- **Consistency**: All instances see same config
