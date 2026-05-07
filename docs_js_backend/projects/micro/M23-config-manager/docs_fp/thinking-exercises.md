# Thinking Exercises

## 1. The Secret

You need to store a database password.

**Question:** Env var? File? Vault? KMS? What's the threat model for each?

---

## 2. The Override

Production config has `LOG_LEVEL=error`. You need debug logs for one hour.

**Question:** How do you change it? Do you restart? What are the risks?

---

## 3. The Validation

A required env var is missing. The app starts anyway.

**Question:** When should validation happen? What should the app do?

---

## 4. The Default

`PORT` defaults to 3000. But another service already uses 3000.

**Question:** Are defaults helpful or dangerous?

---

## 5. The Hot Reload

You want to change config without restarting the app.

**Question:** How do you do it safely? What config CAN'T be changed at runtime?
