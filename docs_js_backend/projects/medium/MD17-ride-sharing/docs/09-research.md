# Research Notes

## Ride Sharing Industry Patterns

### Dispatch Algorithms

**Nearest Driver** (Basic)
- Calculate distance to all available drivers
- Assign closest driver
- Simple but doesn't account for traffic

**Batch Matching** (Uber/Didi)
- Collect requests over a time window
- Solve assignment optimization problem
- Maximize overall system efficiency

**Predictive Dispatch** (Advanced)
- Predict demand hotspots
- Position drivers proactively
- Reduce pickup times

### Surge Pricing Models

**Time-based Multipliers**
- Fixed multipliers during known peak hours
- Simple but not responsive

**Dynamic Demand/Supply**
- Real-time ratio calculation
- Responsive but computationally expensive

**Predictive Surge**
- ML models predict demand spikes
- Proactive pricing adjustments
- Most sophisticated approach

### Location Tracking Best Practices

**Timestamp Validation**
- Reject out-of-order updates
- Implement TTL for stale data

**Interpolation**
- Smooth location jumps
- Predict intermediate positions

**Geofencing**
- Update frequency based on speed
- Higher frequency in urban areas

### Industry Examples

| Platform | Tech Stack | Notable Features |
|----------|-----------|------------------|
| Uber | Go, Python, Java | Michelangelo ML platform |
| Lyft | Python, Go | Amp driver terminal |
| Didi | Go, Java | Real-time dispatch |
| Grab | Go, Java | Multi-service platform |

## References

- [Uber Engineering Blog](https://eng.uber.com/)
- [Lyft Engineering](https://eng.lyft.com/)
- [High Scalability - Uber](http://highscalability.com/blog/2015/9/14/how-uber-scales-their-real-time-market-platform.html)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/best-practices)
