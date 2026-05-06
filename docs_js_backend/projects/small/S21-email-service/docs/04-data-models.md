# 04-data-models.md

## EmailTemplate

| Field    | Type   | Description                |
|----------|--------|----------------------------|
| id       | string | Template identifier        |
| name     | string | Human-readable name        |
| subject  | string | Template subject line      |
| body     | string | Template body (HTML/text)  |

## QueuedEmail

| Field       | Type                  | Description                          |
|-------------|-----------------------|--------------------------------------|
| id          | string                | Unique email ID                      |
| to          | string                | Recipient address                    |
| from        | string                | Sender address                       |
| subject     | string                | Rendered subject                     |
| body        | string                | Rendered body                        |
| templateId  | string?               | Optional template reference          |
| variables   | Record<string,string> | Template substitution map            |
| status      | string                | queued/sending/sent/bounced/opened   |
| attempts    | number                | Retry attempt count                  |
| createdAt   | Date                  | Submission timestamp                 |
| sentAt      | Date?                 | Delivery timestamp                   |
