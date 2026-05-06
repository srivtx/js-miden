# A11 Trading Engine: Research & Citations

## Academic Papers

1. **Budish, E., Cramton, P., & Shim, J. (2015).** "The High-Frequency Trading Arms Race: Frequent Batch Auctions as a Market Design Response." *The Quarterly Journal of Economics*, 130(4), 1547-1621.
   - Proposes batch auctions as an alternative to continuous matching. Argues that the "arms race" for speed is socially wasteful.
   - Relevance: Our price-time priority is the standard, but batch auctions are an emerging alternative.

2. **Aldridge, I. (2013).** *High-Frequency Trading: A Practical Guide to Algorithmic Strategies and Trading Systems*. Wiley.
   - Comprehensive overview of matching engine design, latency optimization, and order types.

3. **Menkveld, A. J. (2016).** "The Economics of High-Frequency Trading: Taking Stock." *Annual Review of Financial Economics*, 8, 1-24.
   - Reviews the academic literature on HFT impact on market quality.

## Industry Standards

4. **FIX Protocol (Financial Information eXchange)**
   - https://www.fixtrading.org/
   - The standard protocol for electronic trading. Defines message formats for orders, executions, and cancellations.

5. **NASDAQ OMX ITCH Specification**
   - https://www.nasdaqtrader.com/content/technicalsupport/specifications/dataproducts/NQTV-ITCH-V5_0.pdf
   - Defines the wire format for order book updates. Shows how real exchanges represent price levels and order IDs.

6. **LMAX Disruptor**
   - https://lmax-exchange.github.io/disruptor/
   - High-performance inter-thread messaging library. Used by LMAX exchange to achieve 1M+ TPS with <1ms latency.
   - Key insight: Ring buffers and lock-free data structures eliminate contention.

## Regulatory Documents

7. **SEC Rule 613 (Consolidated Audit Trail)**
   - https://www.sec.gov/rules/sro/nasdaq/2014/34-73639.pdf
   - Requires exchanges to report every order event with nanosecond timestamps.
   - Relevance: Our `createdAt` field needs microsecond precision in production.

8. **MiFID II (Markets in Financial Instruments Directive)**
   - https://www.esma.europa.eu/policy-rules/mifid-ii-and-mifir
   - EU regulation requiring best execution, transaction reporting, and clock synchronization.

## Books

9. **Harris, L. (2002).** *Trading and Exchanges: Market Microstructure for Practitioners*. Oxford University Press.
   - The definitive textbook on how exchanges work. Covers order types, matching rules, and market design.

10. **Lewis, M. (2014).** *Flash Boys: A Wall Street Revolt*. W. W. Norton & Company.
    - Popular account of the HFT arms race. Less technical, but essential context on why latency matters.

## Related Systems

11. **Coinbase Pro (formerly GDAX) Matching Engine**
    - https://docs.cloud.coinbase.com/exchange/reference/exchangerestapi_getproductbook
    - REST API for order book snapshots. Shows how crypto exchanges expose book state.

12. **Binance Matching Engine**
    - Claims 1.4M orders/second throughput. Uses custom C++ engine with FPGA acceleration for risk checks.

## Database Concurrency

13. **PostgreSQL Advisory Locks**
    - https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS
    - Application-level locks that survive transactions. Ideal for per-symbol matching locks.

14. **Redis Lua Scripting for Atomic Operations**
    - https://redis.io/docs/manual/programmability/eval-intro/
    - Execute complex logic atomically on the Redis server.

## Our Specific Bugs in Literature

15. **Knight Capital Group SEC Filing (2012)**
    - https://www.sec.gov/Archives/edgar/data/1367652/000119312512326343/d367006d8k.htm
    - Official filing describing the $440M loss. Technical root cause: deployment of obsolete code.
