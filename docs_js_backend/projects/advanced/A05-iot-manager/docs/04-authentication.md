# A05: IoT Device Manager - Authentication

## Overview

Device authentication ensures that only legitimate devices can send telemetry and heartbeats. The current implementation uses token-based authentication via HTTP headers.

## Current Implementation

Devices authenticate using two headers:

```
x-device-id: <device-id>
x-auth-token: <auth-token>
```

The token is generated during device registration and stored with the device record.

## Security Considerations

### Phase 1 Limitations
- Simple random string tokens
- No token expiration or rotation
- No certificate-based authentication
- Token comparison is not constant-time (timing attack vulnerability)

### Phase 2-3: Production Authentication

#### Option 1: X.509 Certificates
- Each device has a unique client certificate
- Server validates certificate chain
- Most secure for hardware devices

#### Option 2: JWT Tokens
- Short-lived JWTs signed by a central authority
- Refresh token rotation
- Good for software-based devices

#### Option 3: HMAC Signatures
- Device signs requests with a pre-shared secret
- Server verifies signature
- Resistant to token leakage

## Known Bug

**No Strong Device Authentication**: The current system only validates that the provided token matches the stored token. There is no binding to device hardware, no certificate validation, and no rate limiting on authentication attempts. A leaked device ID and token pair allows an attacker to send fake telemetry.

## Recommended Fix

1. Implement TLS with client certificates for device connections
2. Add token rotation on a scheduled basis
3. Use constant-time comparison for token validation
4. Add rate limiting to prevent brute-force token guessing
