# Fundamentals: Environment Isolation

**Task:** Ensure dev/staging/prod configs never mix.

Principles:
- **Separate storage:** Different files/databases per env
- **Authentication:** Verify who requests config
- **Authorization:** Verify what they can access
- **Audit:** Log all config access
