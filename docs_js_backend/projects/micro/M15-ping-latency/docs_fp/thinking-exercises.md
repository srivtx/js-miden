# Thinking Exercises

## 1. The Private IP

User pings `10.0.0.1`. Should you allow it?

**Question:** What if it's a legitimate use case? How do you balance security and functionality?

---

## 2. The DNS Rebinding

Host `evil.com` resolves to public IP first, then private IP.

**Question:** How do you prevent time-of-check vs time-of-use attacks?

---

## 3. The IPv6

User pings `::1`. Is this localhost?

**Question:** How many forms of localhost exist?

---

## 4. The Redirect

You follow redirects. First hop is public. Second is private.

**Question:** Do you validate every hop? How?

---

## 5. The Timeout

Ping hangs. No timeout configured.

**Question:** How long should a ping wait? What if the user controls the timeout?
