# WHY: Config Server

## Why Use a Config Server?

### 1. Centralized Management
In a microservices architecture, each service has its own configuration files. Updating a database password or API endpoint requires changing dozens of files across multiple repositories. A config server consolidates everything in one place.

### 2. Environment Consistency
Developers, testers, and production systems need different values for the same setting (e.g., `db_host = localhost` vs `db_host = prod-db.example.com`). Centralized config ensures each environment gets the right values.

### 3. Dynamic Updates
Services can reload configuration without restarting. This is critical for changing feature flags, rate limits, or timeout values in production.

### 4. Auditability
A config server can track who changed what and when. This is essential for compliance and debugging.

## Why Environment Isolation Matters

Without strict isolation, a developer testing a new feature in `dev` can accidentally overwrite the production database credentials. A staging deployment can leak into production. Environment isolation is a safety barrier that prevents configuration from bleeding across deployment stages.

## Why Validation Matters

Invalid configuration values (e.g., a negative port number, a malformed URL) can cause services to crash on startup or behave unpredictably. Validating at the config server prevents bad values from reaching production.
