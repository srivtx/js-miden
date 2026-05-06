# 08-CRITIQUE

## Senior Engineer Review

### What is done well
- Adapter pattern cleanly separates channel concerns.
- Template variable substitution is simple and fast.
- Preference store exists and is queryable.

### What is risky
- Synchronous dispatch to all channels blocks the HTTP response. A slow SMTP server makes the API timeout.
- No retry logic per channel. If SMS fails, the notification is lost.
- No deduplication. A retry storm can spam the user.

### What is missing
- Asynchronous dispatch via a message queue.
- Delivery receipts and bounce handling.
- Preference enforcement is the bug, but even if fixed, preferences should be cached to avoid DB lookups on every notify.

### The Bug
Ignoring preferences is a compliance nightmare. In a real company, this bug costs money and reputation. The fix is one line (`filter`), but the real lesson is: always write a test that asserts the negative case (what should NOT happen).
