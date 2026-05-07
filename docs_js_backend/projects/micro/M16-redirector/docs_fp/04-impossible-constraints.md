# Impossible Constraint: No URL Parser

**Task:** Validate that a redirect stays on your domain without `new URL()` or any URL library.

**Constraint:** You can only use string operations.

---

## Your Turn

How do you safely extract a hostname with only `split`, `indexOf`, and `substring`?

**Write your approach:**

<br><br><br><br><br>

---

## The Reveal: It's Impossible to Get Right

URL parsing has edge cases you haven't thought of:
- Internationalized domain names (`https://münchen.de`)
- IPv6 addresses (`https://[2001:db8::1]`)
- Punycode (`https://xn--mnchen-3ya.de`)
- Multiple @ signs (`https://user@evil.com@good.com`)
- Protocol-relative URLs (`//evil.com`)
- Data URIs (`data:text/html,...`)
- JavaScript URIs (`javascript:alert(1)`)

**The point:** URL parsing is a solved problem. Use `new URL()`. Don't reinvent it.

**But this constraint forces you to realize:**

> Security-critical code shouldn't rely on ad-hoc string parsing. The complexity of URL syntax makes hand-rolled parsers inherently buggy.
