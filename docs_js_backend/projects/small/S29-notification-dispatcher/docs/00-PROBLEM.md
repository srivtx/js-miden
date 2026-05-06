# 00-PROBLEM

## WHAT
Build a multi-channel notification dispatcher that sends via email (SMTP), SMS (Twilio), push (FCM), and in-app (WebSocket). It must support templates with variable substitution and honor user preference opt-outs per channel.

## WHY
Users expect notifications on their preferred channel. Sending to every channel regardless of preference is spam, violates regulations (CAN-SPAM, GDPR), and burns money (SMS costs).

## Constraints
- Each channel is a separate adapter with a uniform interface.
- Templates must support variable substitution without code injection.
- Preferences must be checked before every send.
- Delivery should be fire-and-forget from the API perspective.
