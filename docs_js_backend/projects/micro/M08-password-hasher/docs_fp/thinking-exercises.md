# Thinking Exercises

## 1. The Speed Trade-off

You configure bcrypt with cost factor 15. Verification takes 2 seconds. Users complain login is slow.

**Question:** Do you lower the cost factor? What's the minimum acceptable? How do you decide?

---

## 2. The Pepper

Some systems use a "pepper" — a secret key added to the hash, stored separately from the database.

```javascript
const hash = bcrypt.hash(password + PEPPER, 12);
```

**Question:** What's the difference between salt and pepper? When does pepper help?

---

## 3. The Migration

You have 1 million users with MD5-hashed passwords. You want to upgrade to Argon2.

**Question:** How do you migrate without forcing every user to reset their password?

**Hint:** There are two common strategies. Both have trade-offs.

---

## 4. The Comparison

You read that Argon2 won the Password Hashing Competition. Should you use Argon2 or bcrypt?

**Question:** What's the practical difference? When does it matter?

---

## 5. The Breach Response

Your database leaks. Hashes are exposed. The hashes use bcrypt with cost 10.

**Question:** What's your incident response? Do you force all users to reset passwords? How quickly can an attacker crack weak passwords?
