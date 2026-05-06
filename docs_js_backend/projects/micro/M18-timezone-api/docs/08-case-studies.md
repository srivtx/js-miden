# Case Studies

## Case Study 1: Equifax Breach — Log Correlation Failure (2017)

**Incident:** The 2017 Equifax data breach exposed 147 million records. During post-incident analysis, investigators discovered that Equifax's security information and event management (SIEM) system could not correlate logs across subsidiaries because timestamps were stored in **local time without timezone offsets** and in **mixed formats** (Unix epoch, `MM/DD/YYYY`, and ISO 8601).

**Impact:** Delayed breach detection by weeks. Analysts could not reconstruct the attack timeline.

**Lesson:** All server-generated timestamps must be in UTC with ISO 8601 format. Log aggregation pipelines must normalize timezones before indexing.

## Case Study 2: Samoa Skips a Day (2011)

**Incident:** Samoa shifted from the east side of the International Date Line to the west side, skipping 30 December 2011 entirely. Applications that hardcoded the date offset or used `Pacific/Apia` without updating tzdb displayed nonexistent dates or off-by-one-day errors.

**Impact:** Banking and airline systems in the South Pacific region experienced scheduling errors for 48 hours.

**Lesson:** Use named IANA zones (`Pacific/Apia`) and keep tzdb updated. Never hardcode offset-to-date mappings.

## Case Study 3: Russia Abolishes DST (2014)

**Incident:** Russia permanently abolished DST in October 2014. Mobile calendar apps that embedded outdated tzdb continued to shift events by one hour for months.

**Impact:** Millions of Outlook and Android users experienced calendar drift.

**Lesson:** tzdb is a living dataset. OS and runtime updates are security patches for time.

## Timeline: Equifax Log Correlation

```
Attacker: ──[Exploit Apache Struts]───[Exfiltrate data]───[Cover tracks]──→
                                                                   │
Server A (Dallas):    [log: 03/10/2017 02:15 AM CST]               │
Server B (Phoenix):   [log: 03/10/2017 01:15 AM MST]               │
Server C (UTC):       [log: 2017-03-10T08:15:00Z]                   │
                                                                   │
SIEM:                Cannot align logs because formats differ.
                     Analysts manually correlate for 3 weeks.
```

## References

- Equifax Post-Breach Report (U.S. House Committee, 2018)
- IANA tzdb release 2011n (Samoa)
- IANA tzdb release 2014f (Russia)
- NIST SP 800-92: Guide to Computer Security Log Management
