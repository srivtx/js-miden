# Overview: Config Manager

A configuration manager centralizes application settings, supports hot reloading, and validates configuration values to prevent runtime crashes caused by invalid settings.

## Project Goal

Build a config manager that stores settings in JSON, allows updates via API, and reloads configuration without requiring a server restart.

## Learning Outcomes

After completing this project, you will understand:
- Atomic file operations for data integrity
- Configuration validation and type safety
- Hot reload mechanisms
- Schema enforcement
- Environment-specific configuration strategies

## Real-World Context

Configuration management is fundamental to every application. Tools like Consul, etcd, Spring Cloud Config, and Kubernetes ConfigMaps solve this at scale. Understanding the basics is essential.

## File Structure

```
src/
  index.ts           - Express server
  config-manager.ts  - Core config manager
tests/
  config-manager.test.ts - Test suite
docs/
  01-overview.md
  02-requirements.md
  03-architecture.md
  04-what.md
  05-why.md
  06-how.md
  07-wrong-vs-right.md
  08-testing.md
  09-bugs.md
```
