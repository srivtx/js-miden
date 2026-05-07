# Three Wrong Ways to Assign Variants

---

## Wrong #1: Random Per Request

```javascript
return Math.random() > 0.5;
```

**Why it's wrong:** Inconsistent UX. Can't measure anything.

---

## Wrong #2: User ID Modulo

```javascript
return userId.length % 100 < 50;
```

**Why it's wrong:** Non-uniform distribution. Clustering.

---

## Wrong #3: Time-Based

```javascript
return Date.now() % 2 === 0;
```

**Why it's wrong:** Alternates every millisecond. Completely inconsistent.
