# 01-overview.md

## WHAT

An email service that sends emails via SMTP (mock), queues outgoing messages, tracks delivery status (sent/bounced/opened), and supports templates with variable substitution.

## WHY

Applications need reliable email delivery. Queuing prevents blocking, templates ensure consistency, and status tracking provides visibility into deliverability.

## HOW

- `POST /emails/send` — send an email or use a template
- `GET /emails/queue` — view queue status
- `GET /emails/status/:id` — track delivery status
- `GET /emails/templates` — list available templates
- `POST /emails/process-queue` — manually trigger queue processing
