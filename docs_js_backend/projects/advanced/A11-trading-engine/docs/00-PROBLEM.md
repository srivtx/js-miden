# A11 Trading Engine: The Problem

## What Problem Are We Solving?

Financial markets require a neutral, automated intermediary to match buyers with sellers. Without an electronic matching engine, trades happen through phone calls, human brokers, or fragmented over-the-counter (OTC) desks. This creates:

- **Opacity**: No single source of truth for fair market price
- **Inefficiency**: Hours or days to find counterparties
- **Trust asymmetry**: Counterparty risk dominates every transaction
- **Price discrimination**: Large players get better prices than retail

The trading engine is the central nervous system of any exchange. It must receive orders from thousands of participants simultaneously, maintain a sorted book of bids and asks, and execute trades according to deterministic rules.

## Core Requirements

| Requirement | Why It Matters |
|-------------|---------------|
| **Deterministic matching** | Two identical inputs must produce identical outputs. Any non-determinism is an arbitrage exploit. |
| **Sub-millisecond latency** | In HFT, microseconds matter. A 1ms delay can mean $10M+ in missed arbitrage. |
| **Atomic execution** | A trade either fully happens or fully doesn't. Partial fills without atomicity create settlement risk. |
| **FIFO price-time priority** | At the same price, earlier orders must execute first. Queue-jumping destroys market confidence. |
| **Isolation** | One symbol's matching must not block another's. One bad order must not crash the system. |

## The Specific Domain: Equities Order Matching

This engine handles:
- **Limit orders**: "Buy 100 AAPL at $150.00 or better"
- **Market orders**: "Buy 100 AAPL at whatever the best price is"
- **Partial fills**: An order may match against multiple resting orders
- **Cancellations**: Open orders can be cancelled before execution

## Real-World Context

The NASDAQ matching engine processes ~50 billion messages per day. The CME Globex platform handles 100+ million contracts daily. A retail broker's internal crossing engine may handle 1-10 million orders per day. This project represents the foundational logic that scales from a startup crypto exchange to a tier-1 equities venue.

## Why JavaScript/TypeScript?

Traditionally, matching engines were written in C++ (NASDAQ) or Java (LMAX Disruptor). However:
- Modern V8 JIT compilation achieves near-C++ performance for numeric operations
- TypeScript's type safety prevents an entire class of data model bugs
- Node.js event loop + worker threads can achieve microsecond-level scheduling
- The ecosystem (Redis, PostgreSQL, Kafka) has first-class Node.js clients

The trade-off: raw throughput per core is lower than C++, but development velocity and correctness are higher.
