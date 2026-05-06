# E04 API Hub: Research & Citations

## API Design & Management

1. **Fielding, R. T. (2000).** "Architectural Styles and the Design of Network-based Software Architectures." *PhD Dissertation, UC Irvine*.
   - The foundational dissertation on REST. Chapter 5 defines the REST architectural style.
   - https://www.ics.uci.edu/~fielding/pubs/dissertation/top.htm

2. **Richardson, L., & Amundsen, M. (2013).** *RESTful Web APIs*. O'Reilly.
   - Practical guide to designing APIs that follow REST principles.

3. **Zalando RESTful API and Event Guidelines**
   - https://opensource.zalando.com/restful-api-guidelines/
   - Comprehensive API design guidelines used by one of Europe's largest e-commerce platforms.

## API Security

4. **OWASP API Security Top 10 (2023)**
   - https://owasp.org/API-Security/editions/2023/en/0x00-header/
   - The definitive list of API security risks. Our cross-developer bug maps to API1:2023 (Broken Object Level Authorization).

5. **RFC 8725: JSON Web Token Best Current Practices**
   - https://datatracker.ietf.org/doc/html/rfc8725
   - Security best practices for JWT implementation.

6. **OAuth 2.0 Security Best Current Practice**
   - https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics
   - Modern OAuth2 security recommendations, including PKCE for public clients.

## Rate Limiting & Throttling

7. **RFC 6585: Additional HTTP Status Codes**
   - https://datatracker.ietf.org/doc/html/rfc6585
   - Defines 429 Too Many Requests status code.

8. **Cloudflare Rate Limiting Documentation**
   - https://developers.cloudflare.com/waf/rate-limiting-rules/
   - How Cloudflare implements rate limiting at the edge.

## Microservices & Distributed Systems

9. **Newman, S. (2021).** *Building Microservices* (2nd ed.). O'Reilly.
   - Covers service boundaries, inter-service communication, and data ownership.

10. **Richardson, C. (2018).** *Microservices Patterns*. Manning.
    - Patterns for sagas, API gateways, and transactional outbox.

## Industry Case Studies

11. **Stripe Engineering Blog: "Designing APIs for Humans"**
    - https://stripe.com/blog/markdown-ghost-doc
    - How Stripe designs developer-friendly APIs and documentation.

12. **Netflix Tech Blog: "API Gateway at Netflix"**
    - https://netflixtechblog.com/the-netflix-api-gateway-bff-part-1-676d4afcfbdb
    - How Netflix handles API aggregation and routing at scale.

13. **Kong API Gateway Documentation**
    - https://docs.konghq.com/
    - Open-source API gateway that handles auth, rate limiting, and observability.

## Billing & Metering

14. **Stripe Usage-Based Billing**
    - https://stripe.com/docs/billing/subscriptions/usage-based
    - How Stripe implements metered billing with proration and tax.

15. **Twilio Usage Records API**
    - https://www.twilio.com/docs/usage/api/usage-record
    - How Twilio exposes usage data to customers for self-service billing.

## Related to Our Bugs

16. **Facebook Cambridge Analytica Settlement (2019)**
    - https://www.ftc.gov/news-events/news/press-releases/2019/07/ftc-imposes-5-billion-penalty-sweeping-new-privacy-restrictions-facebook
    - $5B FTC fine for improper data sharing via APIs.

17. **OWASP Broken Object Level Authorization (BOLA)**
    - https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
    - Detailed guidance on preventing unauthorized object access.

18. **Shopify Security Bug Bounty Reports**
    - https://hackerone.com/shopify
    - Public bug bounty reports showing real API authorization vulnerabilities.
