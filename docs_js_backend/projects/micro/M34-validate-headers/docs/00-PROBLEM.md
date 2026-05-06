# M34: HTTP Header Validation Middleware

## WHAT
A middleware that validates incoming HTTP headers against configurable rules, supporting both strict (reject) and lenient (warn) modes.

## WHY
APIs often require specific headers (Content-Type, Authorization, custom tokens). Validating headers early prevents downstream errors and improves security posture.

## Constraints
- Must validate Content-Type, Authorization format, and custom headers
- Must support strict mode (HTTP 400 on failure) and lenient mode (warnings)
- Must be configurable with custom rules via RegExp or functions
- Must respect HTTP header case-insensitivity per RFC 2616
- Must not break standard Express middleware chains
