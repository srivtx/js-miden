# A11 Trading Engine: Real-World Bugs & Impact

## Bug 1: Race Condition → Over-Fill

### The Knight Capital Disaster (2012)
**What happened**: Knight Capital deployed new software to its market-making systems. A dormant code path was accidentally activated. The system began buying high and selling low in a loop, sending millions of erroneous orders in 45 minutes.

**Root cause**: Lack of proper state validation and testing of deployment flags. While not identical to our race condition, it shares the DNA: the system assumed its internal state was correct and did not validate before acting.

**Impact**: $440 million lost. Knight Capital was acquired by Getco within months.

**Our bug**: Two concurrent buy orders match the same sell order. Both read `filledQuantity: 0`, both fill 60. The sell order ends up with `filledQuantity: 120` despite `quantity: 100`.

**Real-world equivalent**: An exchange credits both buyers with shares it doesn't have. Settlement fails. One buyer sues. The exchange's clearinghouse must cover the loss.

### The FIX Protocol Bug (2005)
**What happened**: A trader at a hedge fund accidentally sent a sell order for 100x the intended quantity. The order management system had no validation on maximum order size.

**Impact**: $150M loss in minutes, firm bankruptcy.

---

## Bug 2: No Price Validation → Negative Prices

### The 2020 Oil Crash (WTI Crude)
**What happened**: On April 20, 2020, the May futures contract for WTI crude oil traded at **negative $37.63 per barrel**. Traders with long positions had to pay to offload contracts because storage was full.

**Why it's relevant**: While negative prices can be economically valid (as in oil futures), most equity and crypto exchanges do not support them. A system that accepts negative prices for stocks or Bitcoin will:
1. Match any sell order (since -5 < any positive price)
2. Allow buyers to "buy" while receiving money
3. Drain the entire order book instantly

**Our bug**: The route accepts `price: -5` without validation. A market sell at -$5 would match every buy order in the book, transferring money from sellers to buyers.

### The Ethereum "Flash Crash" (2017)
**What happened**: On GDAX (now Coinbase Pro), a multi-million dollar market sell order caused ETH to drop from $317 to $0.10 in seconds. Stop-loss orders triggered at the bottom.

**Root cause**: Lack of circuit breakers and price bands. While not exactly negative prices, it shows what happens when price validation is absent.

**Impact**: Traders with stop-losses lost millions. Coinbase reimbursed some but not all.

---

## Bug 3: Stale State in Distributed Systems

### The Nasdaq Facebook IPO Failure (2012)
**What happened**: During the Facebook IPO, Nasdaq's systems were overwhelmed. Order confirmations were delayed by hours. Traders didn't know if their orders were filled.

**Root cause**: The system could not handle the volume of orders and status updates. State became inconsistent between the matching engine and the reporting system.

**Impact**: $500M in losses for traders. Nasdaq paid $10M fine to SEC.

---

## Prevention Checklist

- [ ] All inputs validated at the API edge (Zod/Joi)
- [ ] Price > 0 for equities, crypto, and most commodities
- [ ] Atomic compare-and-swap for all state mutations
- [ ] Database constraints: `CHECK (filled_quantity <= quantity)`
- [ ] Integration tests with concurrent request simulation
- [ ] Circuit breakers for extreme price moves (>10% in 1 minute)
- [ ] Pre-trade risk checks: max order size, max position, credit limits
- [ ] Post-trade surveillance: detect and flag anomalous fills
