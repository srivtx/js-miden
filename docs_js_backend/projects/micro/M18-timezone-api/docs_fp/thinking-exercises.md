# Thinking Exercises

## 1. The DST Gap

You schedule a daily 2:30 AM job in America/New_York.

**Question:** What happens on DST start day? Does the job run? When?

---

## 2. The Double Hour

You log events with local timestamps. On DST end day, 1:30 AM happens twice.

**Question:** How do you know which 1:30 AM an event occurred at?

---

## 3. The Future Event

You schedule a meeting for March 15, 2030. Between now and then, the timezone rules change.

**Question:** Is your stored time still correct? What did you store?

---

## 4. The UTC Assumption

You assume all servers run in UTC.

**Question:** What breaks if a server is in a different timezone? How do you ensure consistency?

---

## 5. The Format

You need to exchange datetime data between services.

**Question:** ISO 8601, Unix epoch, or RFC 3339? What are the trade-offs?
