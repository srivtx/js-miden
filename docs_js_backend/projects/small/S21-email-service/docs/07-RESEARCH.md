# 07-RESEARCH.md

## Academic & Industry Sources

### Queue-Based Async Processing

1. **Nygard, M. T. (2018).** *Release It! Design and Deploy Production-Ready Software* (2nd ed.). Pragmatic Bookshelf.
   - Chapter 4: "Stability Patterns" — discusses Circuit Breaker and Bulkhead patterns for protecting systems from slow dependencies like SMTP.

2. **Amazon Web Services. (2023).** "AWS Well-Architected Framework: Reliability Pillar."
   - Recommends decoupling components with queues (SQS) to absorb traffic bursts and isolate failures.
   - https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html

### Email Deliverability & Retry

3. **RFC 5321 — Simple Mail Transfer Protocol.** (2008). Internet Engineering Task Force.
   - Section 4.5.4: "Retry Strategies" — specifies that transient failures (4xx) MUST be retried, permanent failures (5xx) SHOULD NOT.
   - https://tools.ietf.org/html/rfc5321

4. **Google. (2024).** "Gmail Bulk Sender Guidelines."
   - Recommends exponential backoff for temporary failures (421 errors).
   - https://support.google.com/mail/answer/81126

5. **Microsoft. (2024).** "Exchange Online email non-delivery reports."
   - Documents greylisting behavior and the expectation of sender retry.
   - https://learn.microsoft.com/en-us/exchange/mailflow-best-practices/non-delivery-reports-in-exchange-online

### Exponential Backoff

6. **Jain, R., & Chiu, D. (1989).** "A Quantitative Measure Of Fairness And Discrimination For Resource Allocation In Shared Computer Systems." DEC Research Report TR-301.
   - Foundational paper on why exponential backoff prevents congestion collapse.

7. **AWS Architecture Blog. (2015).** "Exponential Backoff And Jitter."
   - Demonstrates that exponential backoff with full jitter provides the best balance of throughput and fairness.
   - https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/

### Template Engines & Security

8. **OWASP. (2023).** "Injection Prevention Cheat Sheet."
   - Warns against regex-based substitution for user input due to ReDoS and injection risks.
   - https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html

9. **Mustache / Handlebars Documentation.**
   - Logic-less templating prevents code injection by design.
   - https://handlebarsjs.com/guide/

### Industry Incident Reports

10. **GitHub Engineering. (2018).** "How We Built the GitHub Notifications System."
    - Describes migration from synchronous to queue-based email delivery, reducing p99 latency by 95%.
    - https://github.blog/engineering/

11. **Shopify Engineering. (2021).** "Building Resilient Background Jobs."
    - Documents retry policies, dead letter queues, and idempotency patterns for transactional email.
    - https://shopify.engineering/
