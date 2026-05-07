# Thinking Exercises

## 1. The Encoding

Your CSV has UTF-8 characters. Excel opens it as Windows-1252.

**Question:** How do you ensure correct encoding? What is BOM and when should you use it?

---

## 2. The Delimiter

Your data contains commas. You switch to tab-delimited.

**Question:** What breaks? What new edge cases appear?

---

## 3. The Formula Defense

You prefix all cells with a tab to prevent formula execution.

**Question:** Does this break anything? What applications don't handle the tab prefix?

---

## 4. The Injection Vector

A user uploads a CSV. Your backend parses it and inserts into database.

**Question:** Is SQL injection possible via CSV? How?

---

## 5. The Alternative

You need to export data that users open in Excel.

**Question:** CSV, XLSX, or JSON? What are the trade-offs?
