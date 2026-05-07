# Three Wrong Ways to Handle Timezones

---

## Wrong #1: Fixed Offset

`America/New_York = -5`. Wrong half the year.

---

## Wrong #2: UTC Everywhere

Store UTC, forget timezone context. Users see wrong local time.

---

## Wrong #3: Client-Side Conversion

Trust client's timezone. VPN, travel, wrong settings break it.
