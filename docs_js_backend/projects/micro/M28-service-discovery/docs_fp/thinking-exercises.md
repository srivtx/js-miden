# Thinking Exercises

## 1. The Cache

Registry lookup takes 10ms. You do it on every request.

**Question:** Do you cache? For how long? What if service dies?

---

## 2. The Bootstrap

Registry needs to know its own address.

**Question:** Chicken-and-egg problem. How do you bootstrap?

---

## 3. The Partition

Network partition. Registry can't reach services.

**Question:** Mark all as dead? Keep old list? What's correct?

---

## 4. The Version

Service v1 and v2 run simultaneously.

**Question:** How does discovery handle versioning?

---

## 5. The Security

Anyone can register a service.

**Question:** How do you prevent malicious registration?
