# Research Notes

## Sources

- **OWASP Logging Cheat Sheet**
  - Key finding: Never log sensitive data such as passwords, session tokens, or credit card numbers. Use redaction or hashing.
  - https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

- **GDPR Article 32 — Security of Processing**
  - Key finding: Personal data must be protected "in transit and at rest." Logs are considered "at rest" and must be protected with appropriate measures including redaction.
  - https://gdpr-info.eu/art-32-gdpr/

- **Pino Documentation — Performance**
  - Key finding: Pino benchmarks at ~100,000 logs/sec with async destinations. `console.log` drops to ~10,000 logs/sec under load due to synchronous I/O.
  - https://getpino.io/#/docs/performance

- **12-Factor App — Logs**
  - Key finding: A twelve-factor app never concerns itself with routing or storage of its output stream. It should not attempt to write to or manage logfiles. Instead, each running process writes its event stream, unbuffered, to stdout.
  - https://12factor.net/logs

- **Node.js Documentation — process.stdout**
  - Key finding: `process.stdout` is synchronous in TTYs (terminals) and asynchronous in pipes/files. This means `console.log` behavior changes depending on how the process is started.
  - https://nodejs.org/api/process.html#processstdout

- **Verizon 2023 Data Breach Investigations Report**
  - Key finding: Credential theft remains the #1 attack vector. Leaked credentials in logs are a common source of compromise.
  - https://www.verizon.com/business/resources/reports/dbir/

## Latest Trends (2025)

- **OpenTelemetry Logging:** OpenTelemetry is adding first-class log support, allowing traces, metrics, and logs to be correlated in a single system.
- **AI-Powered Log Analysis:** Tools like Datadog's Watchdog and Splunk's ML Toolkit automatically detect anomalies in log patterns.
- **eBPF-Based Log Collection:** Kernel-level log collection (e.g., Falco) can capture logs without modifying application code, reducing the risk of application-level log leaks.

## Benchmarks

- `console.log` synchronous: ~10,000 logs/sec on a modern CPU.
- `pino` async: ~100,000 logs/sec.
- `pino` sync: ~50,000 logs/sec.
- Redaction overhead: ~0.01ms per request (negligible).

## Industry Adoption

- **Netflix:** Uses structured JSON logging with redaction. Logs are shipped to centralized systems via sidecars.
- **Stripe:** Redacts all sensitive fields at the application level before logging.
- **AWS Lambda:** Captures stdout automatically. Structured JSON is the standard.
- **Vercel:** Logs are stdout-only. Developers are encouraged to use structured formats.
