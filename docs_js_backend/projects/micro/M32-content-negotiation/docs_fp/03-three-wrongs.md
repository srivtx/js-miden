# Three Wrong Ways to Handle Content Negotiation

---

## Wrong #1: Ignore Accept Header

Always return JSON. Breaks clients expecting XML or HTML.

---

## Wrong #2: Wildcard Matching

`Accept: */*` matches everything. But client might not handle all formats.

---

## Wrong #3: No Default Format

If no match, return 406 Not Acceptable. Breaks simple clients.
