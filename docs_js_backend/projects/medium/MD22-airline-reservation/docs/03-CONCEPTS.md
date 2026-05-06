# Core Concepts

## Overbooking in Aviation

Airlines intentionally overbook flights based on historical no-show rates. This is legal and economically rational, but regulated:
- **EU261**: Compensation up to €600 for denied boarding
- **US DOT**: Up to 4x ticket price for involuntary bumping
- **IATA Resolution 735d**: Standard conditions of carriage

## Seat Inventory Management

### Nesting
Business class seats can be sold as economy if demand is low, but not vice versa. Our simplified model doesn't implement nesting.

### Bid Price Controls
Each seat has a minimum acceptable price that increases as inventory decreases. Not implemented here.

## Aircraft Configuration

Aircraft have:
- **Total seats**: Physical capacity
- **Class distribution**: How seats are divided among classes
- **Blocked seats**: Crew rest, maintenance, social distancing

## Booking Classes (RBD - Reservation Booking Designators)

| Code | Class | Example |
|------|-------|---------|
| F | First Class | F, A |
| J | Business Class | J, C, D |
| Y | Economy | Y, B, M, H |

Each letter has different fare rules, change fees, and mileage earning.

## Check-in Windows

- **Online**: Opens 24-48 hours before departure
- **Airport kiosk**: Opens 3-12 hours before
- **Counter**: Varies by airline

## No-Show vs Go-Show

- **No-show**: Passenger doesn't arrive, seat released
- **Go-show**: Passenger arrives without booking, tries to get on standby

## Database Locking Strategies

| Strategy | Mechanism | When to Use |
|----------|-----------|-------------|
| Optimistic | Version field | Low contention |
| Pessimistic | SELECT FOR UPDATE | High contention |
| Advisory | pg_advisory_lock | App-level resources |
| Atomic ops | UPDATE ... WHERE | Counter decrements |
