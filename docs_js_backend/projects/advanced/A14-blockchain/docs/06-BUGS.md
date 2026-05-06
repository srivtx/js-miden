# A14 Blockchain Backend: Real-World Bugs & Impact

## Bug 1: Nonce Reuse → Signature Replay

### The Ethereum Parity Multisig Hack (2017)
**What happened**: A vulnerability in Parity's multisig wallet contract allowed an attacker to take ownership of wallets and drain $30M+ in ETH.

**Root cause**: While not exactly nonce reuse, it was a replay-related vulnerability. The contract did not properly validate initcode, allowing reinitialization.

### The Replay Attack on Ethereum Classic (2016)
**What happened**: After the Ethereum hard fork (DAO hack), transactions on Ethereum were replayed on Ethereum Classic because the chains shared the same transaction format and nonces.

**Root cause**: The fork did not implement chain ID replay protection (EIP-155 was not yet universal).

**Impact**: Users who sold ETH on Ethereum accidentally lost ETC. Exchanges lost millions.

**Our bug**: Two concurrent transactions read nonce=0 simultaneously. Both are created with nonce=0. The network will accept one and reject the other, but the user has no way to know which is which.

### The Ronin Bridge Hack (2022)
**What happened**: Attackers compromised validator nodes and forged withdrawals. $625M stolen.

**Root cause**: Insufficient validator consensus (5 of 9 keys compromised). While not nonce-related, it shows how blockchain state management failures lead to catastrophic losses.

---

## Bug 2: No Confirmation Waiting → Double Spend

### The Bitcoin Gold Double Spend (2018)
**What happened**: Attackers rented hashing power and performed a 51% attack on Bitcoin Gold. They deposited BTG on exchanges, traded for other coins, then reorged the chain to reverse the deposit.

**Root cause**: Exchanges accepted deposits after only a few confirmations. The attacker exploited the low confirmation requirement.

**Impact**: $18M stolen from exchanges.

**Our bug**: The API returns `success: true` immediately after broadcasting, before the transaction is included in a block. A malicious user could:
1. Send a transaction
2. See "success"
3. Immediately send another transaction spending the same funds
4. The first transaction might be dropped, the second confirmed
5. The recipient of the first transaction never gets paid

### The FTX Collapse (2022)
**What happened**: FTX's internal "exchange token" (FTT) and balance sheet were manipulated. Customer deposits were used for trading losses.

**Root cause**: Centralized exchange with no on-chain verification of reserves. Users trusted FTX's database entries.

**Impact**: $8B in customer funds lost. Bankruptcy. Criminal charges.

**Lesson**: Confirmation waiting is not just a technical nicety. It's the difference between "the blockchain says you own this" and "a company says you own this."

---

## Bug 3: Weak Address Generation

### The Blockchain.info Weak RNG (2013)
**What happened**: A bug in Blockchain.info's random number generator produced duplicate private keys. Multiple users ended up with the same Bitcoin address.

**Root cause**: Insufficient entropy in `Math.random()` equivalent.

**Impact**: Funds were stolen by users who discovered the collisions.

**Our bug**: The wallet route generates addresses with `Math.random()`. This is cryptographically insecure and could produce collisions.

---

## Prevention Checklist

- [ ] Atomic nonce increment with per-address locking
- [ ] Include chain ID in transaction signatures (EIP-155)
- [ ] Wait for N confirmations before considering a transaction final
- [ ] Use cryptographically secure random number generation (`crypto.randomBytes`)
- [ ] Verify transaction signatures server-side before broadcasting
- [ ] Implement replace-by-fee (RBF) handling for stuck transactions
- [ ] Monitor mempool for pending transactions from your addresses
- [ ] Hardware Security Modules (HSMs) for key management in production
- [ ] Multi-sig for large transactions
- [ ] Formal verification for critical smart contracts
