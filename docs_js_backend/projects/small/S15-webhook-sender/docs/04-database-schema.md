# Database Schema

## webhooks

| Column       | Type       | Description                |
|--------------|------------|----------------------------|
| id           | SERIAL PK  | Webhook ID                 |
| url          | TEXT       | Target URL                 |
| secret       | TEXT       | HMAC secret                |
| event_types  | TEXT[]     | Subscribed event types     |
| created_at   | TIMESTAMP  | Registration time          |

## delivery_logs

| Column          | Type       | Description                           |
|-----------------|------------|---------------------------------------|
| id              | SERIAL PK  | Log entry ID                          |
| webhook_id      | INTEGER FK | Related webhook                       |
| event_type      | TEXT       | Event type delivered                  |
| payload         | JSONB      | Payload sent                          |
| status          | TEXT       | pending / success / failed            |
| response_status | INTEGER    | HTTP response code                    |
| response_body   | TEXT       | Response body (truncated)             |
| attempt_count   | INTEGER    | Number of delivery attempts           |
| next_retry_at   | TIMESTAMP  | Next scheduled retry                  |
| created_at      | TIMESTAMP  | First attempt time                    |
| updated_at      | TIMESTAMP  | Last update time                      |
