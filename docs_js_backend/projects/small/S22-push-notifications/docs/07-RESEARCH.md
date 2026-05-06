# 07-RESEARCH.md

## Academic & Industry Sources

### Push Notification Architecture

1. **Apple Inc. (2023).** "Apple Push Notification Service (APNs) Documentation."
   - Describes HTTP/2-based provider API with multiplexed streams over a single connection.
   - Recommends batching and connection reuse for efficiency.
   - https://developer.apple.com/documentation/usernotifications

2. **Google Firebase. (2024).** "Firebase Cloud Messaging: Send Messages to Multiple Devices."
   - Documents FCM multicast API supporting up to 500 registration tokens per request.
   - https://firebase.google.com/docs/cloud-messaging/send-message#send-messages-to-multiple-devices

3. **RFC 8030 — Generic Event Delivery Using HTTP Push.** (2016). IETF.
   - Standardizes push notification protocols and batch delivery semantics.
   - https://tools.ietf.org/html/rfc8030

### Token Validation & Lifecycle

4. **Google Firebase. (2024).** "Handle Invalid Token Responses."
   - Recommends removing tokens that return `InvalidRegistration` or `NotRegistered` to maintain database hygiene.
   - https://firebase.google.com/docs/cloud-messaging/manage-tokens

5. **Apple Inc. (2023).** "Handling Notification Responses from APNs."
   - Documents `BadDeviceToken` and `Unregistered` error codes with cleanup recommendations.

### Batch Processing & Performance

6. **Martin Kleppmann. (2017).** *Designing Data-Intensive Applications.* O'Reilly Media.
   - Chapter 11: "Stream Processing" — discusses batching as a fundamental optimization for I/O-bound systems.

7. **AWS Architecture Blog. (2019).** "Best Practices for Amazon SNS Mobile Push Notifications."
   - Recommends batching, token validation, and parallelization to minimize latency and cost.
   - https://aws.amazon.com/blogs/mobile/

### Rate Limiting & Abuse Prevention

8. **Cloudflare. (2024).** "Rate Limiting Rules."
   - Documents token bucket and sliding window algorithms for API protection.
   - https://developers.cloudflare.com/waf/rate-limiting-rules/

9. **OWASP. (2023).** "API Security Top 10: API4:2023 Unrestricted Resource Consumption."
   - Identifies unbounded API calls as a critical security risk.
   - https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/

### Industry Incident Reports

10. **Facebook Engineering. (2017).** "Scaling Push Notifications for 2 Billion Users."
    - Describes migration from sequential to batched push delivery, reducing p99 latency by 99%.
    - https://engineering.fb.com/

11. **Uber Engineering. (2018).** "Building Uber's Notification Platform."
    - Documents token validation, batching, and multi-provider fallback strategies.
    - https://www.uber.com/en-US/blog/engineering/
