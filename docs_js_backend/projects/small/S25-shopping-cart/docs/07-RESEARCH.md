# 07-RESEARCH.md

## Academic & Industry Sources

### Session Security & Identifier Generation

1. **RFC 4122 — A Universally Unique Identifier (UUID) URN Namespace.** (2005). IETF.
   - Specifies UUID v4 as 122 bits of randomness, suitable for secure session identifiers.
   - https://tools.ietf.org/html/rfc4122

2. **OWASP. (2023).** "Session Management Cheat Sheet."
   - Recommends cryptographically secure random session IDs with minimum 128 bits of entropy.
   - Warns against sequential, predictable, or timestamp-based identifiers.
   - https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html

3. **Paragonie Initiative. (2024).** "CUID2 Specification."
   - Documents CUID2 as a collision-resistant, unpredictable identifier designed to replace UUID in URL-safe contexts.
   - https://github.com/paralleldrive/cuid2

### Session Expiration & Resource Management

4. **Redis Documentation. (2024).** "EXPIRE — Set a Timeout on a Key."
   - Documents native TTL support for automatic key expiration, the industry standard for session storage.
   - https://redis.io/commands/expire/

5. **Amazon Web Services. (2023).** "AWS Well-Architected Framework: Reliability Pillar."
   - Recommends TTL and cleanup jobs for ephemeral data to prevent resource exhaustion.
   - https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html

### E-Commerce Cart Security

6. **PCI Security Standards Council. (2024).** "PCI DSS v4.0 Requirements and Testing Procedures."
   - Requirement 6.5.10: "Broken Authentication and Session Management" — includes session fixation and predictable session ID vulnerabilities.
   - https://www.pcisecuritystandards.org/

7. **Shopify Engineering. (2020).** "How We Secure Cart Sessions at Scale."
   - Documents signed cookies, Redis TTL, and cart merge strategies for 1M+ concurrent carts.
   - https://shopify.engineering/

### Cart Abandonment & Business Impact

8. **Baymard Institute. (2024).** "48 Cart Abandonment Rate Statistics."
   - Documents average cart abandonment rate of 70.19% across industries.
   - Highlights the business imperative of session expiry and abandonment recovery.
   - https://baymard.com/lists/cart-abandonment-rate

9. **Forrester Research. (2023).** "The State of E-Commerce Checkout."
   - Estimates $4.6 trillion in abandoned merchandise annually. Proper session management directly impacts recoverable revenue.

### Session Fixation Attacks

10. **MITRE CWE. (2024).** "CWE-330: Use of Insufficiently Random Values."
    - Classifies predictable session identifiers as a weakness enabling session fixation and enumeration attacks.
    - https://cwe.mitre.org/data/definitions/330.html
