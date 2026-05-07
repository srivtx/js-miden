# The Principle: What Did CSV Teach You?

## The Fundamental Truth

> **"Data formats are simple to describe and hard to implement. Never trust a hand-rolled parser for a format that's older than you are."**

## The Junior Question

A junior dev says: "CSV is just split by comma. Why do we need a library?"

**What's wrong with this?**

<br><br><br><br><br>

---

## The Answer

CSV has edge cases that seem obvious in hindsight but break naive parsers:
- Quoted fields with commas
- Quoted fields with newlines
- Escaped quotes (`""`)
- Empty fields
- Trailing newlines
- Different line endings (CRLF vs LF)
- BOM (Byte Order Mark) at file start

**RFC 4180 is 20 pages long.** For "just commas."

## The Realization

The danger isn't the parser. It's the **interpreter**.

CSV is data. But Excel INTERPRETS data as formulas. Your parser passes through `=cmd|...` because it's valid CSV. Excel executes it because it starts with `=`.

**The fix isn't better CSV parsing. It's output sanitization.**
