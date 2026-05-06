# PROBLEM: Config Manager

## WHAT We're Building

A configuration manager that stores application settings in JSON, allows updates via API, validates configuration values, and persists data atomically to prevent corruption.

## WHY This Matters

Configuration drives application behavior. A single wrong value (e.g., `timeout: "infinite"` instead of `timeout: 5000`) can crash a production system. Configuration management is foundational: every application needs it, and getting it wrong causes outages, data loss, and security vulnerabilities.

## Constraints

1. **Atomic Writes**: Configuration must never be partially written
2. **Type Validation**: Reject values that don't match expected types
3. **Hot Reload**: Read latest config without restart
4. **JSON Format**: Human-readable, machine-parseable
5. **File-Based**: No database dependency for this micro-project
6. **Crash Safety**: Process crash during write must not corrupt config
7. **Error Handling**: Graceful handling of missing files and invalid JSON

## Real-World Context

Configuration management is fundamental. Tools like Consul, etcd, Spring Cloud Config, and Kubernetes ConfigMaps solve this at scale. In 2017, a misconfiguration in AWS S3's billing system took down a significant portion of the internet for 4 hours. In 2021, a Facebook BGP misconfiguration caused a 6-hour global outage. Configuration is not just convenience; it's critical infrastructure.

## Success Criteria

- [ ] Config loads from file on startup
- [ ] Config values are retrievable by key
- [ ] Config updates persist to file
- [ ] Invalid types are rejected with clear errors
- [ ] File writes are atomic (no corruption on crash)
- [ ] Missing config returns 404, not crash
- [ ] Bulk updates work correctly
