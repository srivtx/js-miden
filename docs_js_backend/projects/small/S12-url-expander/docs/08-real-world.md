# S12 URL Expander — Real-World Examples

## URL Shorteners (bit.ly, t.co, tinyurl)

These services exist solely to create short links that redirect to long URLs.
- **Analytics**: Track clicks, geolocation, referrer.
- **Expiration**: Some links expire after a date or number of clicks.
- **Malware filtering**: Block redirects to known phishing domains.

### Lesson
URL expanders are critical security infrastructure. Email gateways and social media platforms expand and scan all short links before displaying them to users.

## Link Preview Services (Slack, Telegram, Twitter Cards)

When you paste a link, these services:
1. Expand the URL to find the final destination.
2. Fetch the HTML to extract Open Graph metadata (title, image, description).
3. Render a preview card.

### Security Challenge
These services are prime SSRF targets because they must fetch arbitrary user-submitted URLs. They use heavily sandboxed egress proxies and strict IP blocklists.

## Web Crawlers (Googlebot, Bingbot)

Search engine crawlers follow redirects to index the canonical content.
- **Redirect limits**: Googlebot stops after ~5 redirects and may drop the page from indexing.
- **Canonical URLs**: 301 redirects pass link equity; 302 redirects may not.

## SSRF in the Wild

### Capital One Breach (2019)
An attacker exploited an SSRF vulnerability in a WAF to access AWS metadata and steal credentials, compromising 100 million customer records.

### Shopify Bug Bounty
Researchers frequently find SSRF via URL expansion/preview features that fail to validate redirect targets.

### Lesson
Never trust a URL based solely on its initial hostname. Always validate every hop, resolve IPs, and restrict egress.
