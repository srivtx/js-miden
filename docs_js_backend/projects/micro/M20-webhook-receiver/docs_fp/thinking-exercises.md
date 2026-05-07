# Thinking Exercises

## 1. The Retry

Stripe retries webhooks up to 3 days. Your database was down for 2 hours.

**Question:** How do you handle 72 hours of queued retries?

---

## 2. The Ordering

Events arrive out of order: `payment.created` after `payment.success`.

**Question:** How do you handle out-of-order events?

---

## 3. The Timeout

Your processing takes 10 seconds. Stripe times out at 30.

**Question:** Do you respond before or after processing? What's the risk?

---

## 4. The Migration

You switch webhook providers. Old events might still arrive.

**Question:** How do you support two webhook formats simultaneously?

---

## 5. The Secret Rotation

Your webhook secret is compromised. How do you rotate without missing events?
