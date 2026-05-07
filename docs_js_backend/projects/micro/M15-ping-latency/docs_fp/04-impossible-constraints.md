# Impossible Constraint: No Network Access

**Task:** Implement ping without network access.

**Constraint:** You cannot open sockets, make HTTP requests, or use `dns`.

---

## Your Turn

Can you check if a host is reachable without network access?

**Write your approach:**

<br><br><br><br><br>

---

## The Reveal: You Can't

Reachability requires network access. Without it, you can only:
- Check if the hostname format is valid
- Check if the IP is in a valid range
- Check your local routing table

**This constraint forces you to realize:**

> "Ping" is a network operation. You can't simulate it locally. If you need ping, you need network. If you can't have network, you can't have ping.

**Real-world implication:** Health checks in air-gapped environments need alternative approaches (file-based, shared memory, etc.).
