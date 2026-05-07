# The Principle: What Did Discovery Teach You?

## The Fundamental Truth

> **"You can't call what you can't find. Service discovery is the phone book of distributed systems. Without it, you're dialing random numbers."**

## The Junior Question

A junior dev says: "We'll just use hardcoded IPs. It's simpler."

**What's wrong with this?**

<br><br><br><br><br>

---

## The Answer

Hardcoded IPs work for:
- Single server
- Static infrastructure
- Never-changing deployments

**They fail for:**
- Auto-scaling (IPs change)
- Cloud (VMs come and go)
- Container orchestration (pods restart with new IPs)
- Local development (everyone's IP is different)

## The Realization

Service discovery is not optional in modern systems. The choices:
- **DNS:** Simple, but slow to update
- **Consul/etcd/ZooKeeper:** Robust, but add complexity
- **Kubernetes DNS:** Automatic, but K8s-specific
- **Custom registry:** Flexible, but you build it

**Choose based on your platform.**
