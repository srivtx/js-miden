# 00-PROBLEM.md

## The Core Problem

How do you build a session-based shopping cart that is secure (unpredictable IDs), automatically cleans up old sessions, and merges guest carts on login—without leaking cart data or exhausting memory?

## Real-World Context

Shopping carts are the heart of e-commerce. A broken cart directly translates to lost revenue. Security researchers regularly find cart ID enumeration vulnerabilities in major retailers. Session storage exhaustion is a common cause of e-commerce outages during holiday sales.

## Specific Pain Points

1. **Predictable cart IDs**: Sequential counters (`cart-1`, `cart-2`) let attackers access and manipulate other users' carts
2. **No expiry**: Carts accumulate forever, causing memory leaks and storage costs
3. **No session security**: Cart IDs passed in URLs or cookies without signing or encryption
4. **Merge conflicts**: Guest cart and user cart both contain the same product; quantities should add, not replace
5. **No cleanup**: Abandoned carts from 6 months ago still occupy database rows

## What This Project Demonstrates

A session-based shopping cart with add/remove/merge functionality—but with predictable IDs and no expiration logic.

## ASCII: Broken vs Correct Flow

```
BROKEN (Predictable)                     CORRECT (Secure)
====================                     ================

User A creates cart                        User A creates cart
       |                                         |
       v                                         v
  cart-id: cart-1                        cart-id: a1b2-c3d4-...
       |                                         |
       v                                         v
User B guesses: /cart/cart-1              Attacker tries random UUID
       |                                         |
       v                                         v
  [Accesses User A's cart!]             [1 in 2^122 chance — impossible]
       |                                         |
       v                                         v
User B changes items                     Cart auto-expires after 24h
       |                                         |
       v                                         v
User A checks out — wrong items!         Clean, secure, fresh carts
```

## Domain

Session management, cryptographically secure randomness, TTL/expiration, cart merge strategies, e-commerce security.
