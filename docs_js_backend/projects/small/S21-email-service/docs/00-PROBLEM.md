# 00-PROBLEM.md

## The Core Problem

How do you send emails from a web application without blocking HTTP responses, losing messages on server crashes, or permanently failing on transient SMTP errors?

## Real-World Context

Every SaaS application needs transactional email: welcome messages, password resets, invoices, notifications. The naive approach—calling SMTP directly inside the HTTP request handler—creates cascading failures under load. A single slow SMTP server can bring down your entire API.

## Specific Pain Points

1. **Synchronous blocking**: `await smtpSend()` inside HTTP handlers delays responses by 200-2000ms per email
2. **No durability**: If the server crashes mid-send, the email is lost forever with no record
3. **No retry logic**: Network blips, rate limits, or temporary greylisting permanently fail legitimate emails
4. **Template inconsistency**: Hardcoded strings scattered across controllers lead to brand drift and errors
5. **No observability**: Was the email sent? Bounced? Opened? Nobody knows.

## What This Project Demonstrates

A minimal but flawed email service written in TypeScript/Express that exhibits all five problems above, with failing tests that prove the bugs and a corrected architecture that fixes them.

## ASCII: Naive vs Correct Flow

```
NAIVE (BROKEN)                    CORRECT (QUEUED)
============                      ================

Client                            Client
  |                                 |
  | POST /send                      | POST /send
  |----------------------------->   |----------------------------->
  |                                 |     |
  |                                 |     v
  |                                 |   [Queue]
  |                                 |     | 202 Accepted (5ms)
  |                                 |<----|
  |                                 |
  | SMTP send (500ms)               | [Background Worker]
  |                                 |     |
  |                                 |     v
  | 202 Accepted (500ms+)           |   SMTP send
  |<-----------------------------   |     |
  |                                 |     v
  |                                 |   Status: sent/bounced
  |                                 |

RISK: Crash here = lost email      RISK: Crash = email still in queue
```

## Domain

Backend service architecture, asynchronous job processing, SMTP deliverability, template engines.
