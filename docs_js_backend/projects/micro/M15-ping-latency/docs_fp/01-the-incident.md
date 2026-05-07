# The 3AM Page: The Internal Scanner

It's 4:00 AM. Security is alarmed.

**Security:** "Someone is scanning our internal network from the API server."

You check the ping endpoint:
```javascript
app.get('/ping', async (req, res) => {
  const { host } = req.query;
  const result = await ping(host);
  res.json(result);
});
```

**No validation. Any host is allowed.**

An attacker:
1. Discovers `/ping?host=169.254.169.254` (AWS metadata service)
2. Gets IAM credentials
3. Uses credentials to access AWS resources
4. Data breach

**Your ping endpoint is an SSRF (Server-Side Request Forgery) vulnerability.**
