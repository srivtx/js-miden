# 04-OLD-VS-NEW

## 2015 Patterns
- Direct SMTP calls inside the request handler.
- No preference center; users cannot opt out.
- Hardcoded email text; no templates.
- Single channel (email only).
- Fire-and-forget with no tracking of delivery status.

## 2025 Patterns
- Event-driven dispatch via message bus or queue.
- Preference management UI with granular channel controls.
- Template engines (Handlebars, MJML for email) with strict escaping.
- Multi-channel: email, SMS, push, in-app, Slack, WhatsApp.
- Delivery tracking, bounce handling, and suppression lists.
- CDC (Change Data Capture) to trigger notifications from DB changes.
